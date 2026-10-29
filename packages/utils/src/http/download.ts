import { randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PassThrough, Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { UtilsError } from '../error'
import type { DownloadOptions, DownloadResult } from './download-options'
import { requestDownload } from './download-request'
import { createTarExtractor } from './download-tar'
import {
  assertContentLength,
  assertDownloadedSize,
  assertIntegrity,
  createIntegrityVerifier,
  createSizeLimiter,
  resolveMaxBytes,
} from './download-validation'

export type { DownloadOptions, DownloadResult } from './download-options'

/**
 * 下载 HTTP(S) 资源并写入目标目录
 * @remarks
 * 响应体逐块检查大小，完成后仍返回完整 Buffer；超限时取消剩余响应
 * 普通文件校验完成后通过同目录临时文件重命名发布，失败时清理临时文件
 * 替换已有普通文件时保留其读、写、执行权限，暂存文件不会获得更宽的权限
 * tar 解压直接写入目标目录，失败时可能保留已解压条目
 * @param url - 资源地址
 * @param destination - 写入或解压资源的目标目录
 * @param options - 下载选项
 * @returns 可作为 Promise 或双工流消费的下载结果
 * @throws URL 协议、HTTP 状态、响应大小或文件处理不符合约束时抛出错误
 */
export default function download(
  url: string,
  destination?: string,
  options?: DownloadOptions,
): DownloadResult

/**
 * 下载 HTTP(S) 资源并返回完整响应内容
 * @remarks 响应体逐块检查大小，完成后仍返回完整 Buffer；超限时取消剩余响应
 * @param url - 资源地址
 * @param options - 下载选项
 * @returns 可作为 Promise 或双工流消费的下载结果
 * @throws URL 协议、HTTP 状态或响应大小不符合约束时抛出错误
 */
export default function download(
  url: string,
  options?: DownloadOptions,
): DownloadResult
export default function download(
  url: string,
  destination?: string | DownloadOptions,
  options: DownloadOptions = {},
): DownloadResult {
  if (typeof destination !== 'string') {
    options = destination ?? options
    destination = undefined
  }

  const stream = new PassThrough() as unknown as DownloadResult
  const promise = downloadResource(url, destination, options).catch(cause =>
    normalizeDownloadError('http.download', cause),
  )

  // 兼容历史 Promise + Duplex API，完整内容下载后再向兼容流交付
  void stream.on('error', () => {})
  stream.then = promise.then.bind(promise)
  stream.catch = promise.catch.bind(promise)
  stream.finally = promise.finally.bind(promise)
  void promise.then(
    data => {
      void stream.end(data)
    },
    error => {
      void stream.destroy(error as Error)
    },
  )

  return stream
}

/**
 * 以流式方式下载 HTTP(S) 资源并写入或解压到目标目录
 *
 * @remarks
 * 响应体不会完整保存在内存中，响应大小在流经管道时持续校验
 * 普通文件校验完成后通过同目录临时文件重命名发布，失败时清理临时文件
 * 替换已有普通文件时保留其读、写、执行权限，暂存文件不会获得更宽的权限
 * tar 解压直接写入目标目录，失败时清理临时归档但可能保留已解压条目
 *
 * @param url - 资源地址
 * @param destination - 写入或解压资源的目标目录
 * @param options - 下载选项
 * @returns 文件写入或解压完成后结束
 * @throws URL 协议、HTTP 状态、响应大小或文件处理不符合约束时抛出错误
 */
export async function downloadTo(
  url: string,
  destination: string,
  options: DownloadOptions = {},
): Promise<void> {
  try {
    await withDownloadResponse(
      url,
      options,
      async ({ parsedUrl, response }) => {
        const maxBytes = resolveMaxBytes(options.maxBytes)
        assertContentLength(response, maxBytes, parsedUrl.href)

        const source = response.body
          ? Readable.fromWeb(response.body)
          : Readable.from([])
        const limiter = createSizeLimiter(maxBytes, parsedUrl.href)
        const integrityVerifier = createIntegrityVerifier(options.integrity)

        if (options.extract) {
          const archiveRoot = await mkdtemp(
            path.join(tmpdir(), 'eljs-download-'),
          )
          const archivePath = path.join(archiveRoot, 'archive.tgz')

          await runWithCleanup(
            archiveRoot,
            async () => {
              // 先校验完整归档，再写入目标目录，摘要失败时不会留下解压残片
              await pipeline(
                source,
                limiter,
                integrityVerifier,
                createWriteStream(archivePath),
              )
              await mkdir(destination, { recursive: true })
              await pipeline(
                createReadStream(archivePath),
                createTarExtractor(destination, options),
              )
            },
            true,
          )
          return
        }

        await mkdir(destination, { recursive: true })
        const filename = getSafeFilename(
          options.filename,
          response.url || parsedUrl.href,
        )
        await publishFile(
          destination,
          filename,
          async (temporaryPath, mode) => {
            await pipeline(
              source,
              limiter,
              integrityVerifier,
              createWriteStream(temporaryPath, { flags: 'wx', mode }),
            )
          },
        )
      },
    )
  } catch (cause) {
    normalizeDownloadError('http.downloadTo', cause)
  }
}

/**
 * 将底层取消异常转换为下载 API 的稳定错误
 *
 * @param operation - 下载操作名称
 * @param cause - 底层异常
 * @throws 取消或超时时抛出 {@link UtilsError}，其他异常保持原样
 * @internal
 */
function normalizeDownloadError(operation: string, cause: unknown): never {
  if (
    cause instanceof Error &&
    (cause.name === 'AbortError' || cause.name === 'TimeoutError')
  ) {
    throw new UtilsError('ERR_OPERATION_ABORTED', 'Download was aborted', {
      cause,
      operation,
    })
  }

  throw cause
}

/**
 * 请求资源，并根据参数返回、写入或解压完整响应内容
 * @param url - 资源地址
 * @param destination - 可选目标目录
 * @param options - 下载选项
 * @returns 完整响应内容
 * @internal
 */
async function downloadResource(
  url: string,
  destination: string | undefined,
  options: DownloadOptions,
): Promise<Buffer> {
  return withDownloadResponse(url, options, async ({ parsedUrl, response }) => {
    const maxBytes = resolveMaxBytes(options.maxBytes)
    assertContentLength(response, maxBytes, parsedUrl.href)
    const chunks: Uint8Array[] = []
    let receivedBytes = 0
    const reader = response.body?.getReader()

    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            break
          }

          receivedBytes += value.byteLength
          assertDownloadedSize(receivedBytes, maxBytes, parsedUrl.href)
          chunks.push(value)
        }
      } finally {
        // 释放锁后由响应生命周期统一取消未消费的数据
        reader.releaseLock()
      }
    }

    const data = Buffer.concat(chunks, receivedBytes)
    assertIntegrity(data, options.integrity)

    if (!destination) {
      return data
    }

    await mkdir(destination, { recursive: true })

    if (options.extract) {
      await pipeline(
        Readable.from([data]),
        createTarExtractor(destination, options),
      )
      return data
    }

    const filename = getSafeFilename(
      options.filename,
      response.url || parsedUrl.href,
    )
    await publishFile(destination, filename, (temporaryPath, mode) =>
      writeFile(temporaryPath, data, { flag: 'wx', mode }),
    )

    return data
  })
}

/**
 * 消费下载响应，失败时取消未锁定的响应体，最后关闭请求代理
 * @param url - 资源地址
 * @param options - 下载选项
 * @param consume - 响应消费函数
 * @returns 响应消费结果
 * @throws 消费或清理失败时抛出错误，两者均失败时抛出 `AggregateError`
 * @internal
 */
async function withDownloadResponse<Result>(
  url: string,
  options: DownloadOptions,
  consume: (value: { parsedUrl: URL; response: Response }) => Promise<Result>,
): Promise<Result> {
  const { dispatcher, parsedUrl, response } = await requestDownload(
    url,
    options,
  )
  let consumeError: unknown
  let consumeResult: Result | undefined

  try {
    consumeResult = await consume({ parsedUrl, response })
  } catch (error) {
    consumeError = error
  }

  let cleanupError: unknown

  if (consumeError !== undefined && response.body && !response.body.locked) {
    try {
      await response.body.cancel(consumeError)
    } catch (error) {
      // 已出错的 Web Stream 会再次抛出读取错误，不算独立的清理失败
      if (error !== consumeError) {
        cleanupError = error
      }
    }
  }

  if (dispatcher) {
    try {
      await dispatcher.close()
    } catch (error) {
      cleanupError =
        cleanupError === undefined
          ? error
          : new AggregateError([cleanupError, error], 'Download cleanup failed')
    }
  }

  if (consumeError !== undefined && cleanupError !== undefined) {
    throw new AggregateError(
      [consumeError, cleanupError],
      'Download failed and response cleanup also failed',
      { cause: cleanupError },
    )
  }

  if (consumeError !== undefined) {
    throw consumeError
  }

  if (cleanupError !== undefined) {
    throw cleanupError
  }

  return consumeResult as Result
}

/**
 * 在目标目录暂存普通文件，写入成功后重命名发布并清理临时路径
 * @remarks 保留已有普通文件的 rwx 权限，不继承符号链接目标或特殊权限位；校验不提供并发隔离
 * @param destination - 已创建的目标目录
 * @param filename - 已校验的目标文件名
 * @param write - 按给定权限排他创建并写入临时路径的任务，未指定权限时遵循默认值与 umask
 * @returns 文件发布和临时路径清理完成后结束
 * @internal
 */
async function publishFile(
  destination: string,
  filename: string,
  write: (temporaryPath: string, mode: number | undefined) => Promise<void>,
): Promise<void> {
  const targetPath = path.join(destination, filename)
  let mode: number | undefined
  try {
    const target = await lstat(targetPath)
    if (target.isFile()) {
      mode = target.mode & 0o777
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
  const temporaryPath = path.join(
    destination,
    `.${filename}.${randomUUID()}.tmp`,
  )

  await runWithCleanup(temporaryPath, async () => {
    await write(temporaryPath, mode)
    if (mode !== undefined) {
      // 创建时受 umask 限制，写入后恢复原权限再发布，避免暂存内容比目标更开放
      await chmod(temporaryPath, mode)
    }
    await rename(temporaryPath, targetPath)
  })
}

/**
 * 执行任务并在任务结束后清理临时路径
 * @param cleanupPath - 要清理的临时路径
 * @param task - 使用临时路径的任务
 * @param recursive - 是否递归清理目录
 * @returns 任务和清理均完成后结束
 * @throws 任务或清理失败时抛出错误，两者均失败时抛出 `AggregateError`
 * @internal
 */
async function runWithCleanup(
  cleanupPath: string,
  task: () => Promise<void>,
  recursive = false,
): Promise<void> {
  let taskError: unknown

  try {
    await task()
  } catch (error) {
    taskError = error
  }

  let cleanupError: unknown

  try {
    await rm(cleanupPath, { force: true, recursive })
  } catch (error) {
    cleanupError = error
  }

  if (taskError !== undefined && cleanupError !== undefined) {
    throw new AggregateError(
      [taskError, cleanupError],
      'Download failed and temporary output cleanup also failed',
      { cause: cleanupError },
    )
  }

  if (taskError !== undefined) {
    throw taskError
  }

  if (cleanupError !== undefined) {
    throw cleanupError
  }
}

/**
 * 根据显式文件名或最终响应地址生成安全的文件名
 * @param filename - 显式文件名
 * @param url - 最终响应地址
 * @returns 不包含父目录信息的安全文件名
 * @internal
 */
function getSafeFilename(filename: string | undefined, url: string): string {
  const candidate = filename || path.basename(new URL(url).pathname)
  const safeFilename = path.basename(candidate)

  if (!safeFilename || safeFilename === '.' || safeFilename === path.sep) {
    throw new Error(
      `Unable to determine a safe filename for ${formatUrlForDiagnostics(url)}`,
    )
  }

  return safeFilename
}

/**
 * 移除 HTTP 地址中的认证和签名信息后用于诊断
 *
 * @param url - 原始 HTTP 地址
 * @returns 不包含用户信息、查询参数和片段的地址
 * @internal
 */
function formatUrlForDiagnostics(url: string): string {
  const parsed = new URL(url)
  parsed.username = ''
  parsed.password = ''
  parsed.search = ''
  parsed.hash = ''
  return parsed.href
}
