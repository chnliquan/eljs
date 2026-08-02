import { randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
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
    options = destination ?? {}
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
        const outputPath = path.join(destination, filename)
        const temporaryPath = path.join(
          destination,
          `.${filename}.${randomUUID()}.tmp`,
        )

        await runWithCleanup(temporaryPath, async () => {
          await pipeline(
            source,
            limiter,
            integrityVerifier,
            createWriteStream(temporaryPath),
          )
          await rename(temporaryPath, outputPath)
        })
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
    const data = Buffer.from(await response.arrayBuffer())
    assertDownloadedSize(data.byteLength, maxBytes, parsedUrl.href)
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
    await writeFile(path.join(destination, filename), data)

    return data
  })
}

/**
 * 消费下载响应并确保请求代理在响应处理完成后关闭
 * @param url - 资源地址
 * @param options - 下载选项
 * @param consume - 响应消费函数
 * @returns 响应消费结果
 * @throws 消费或代理清理失败时抛出错误，两者均失败时抛出 `AggregateError`
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

  if (dispatcher) {
    try {
      await dispatcher.close()
    } catch (error) {
      cleanupError = error
    }
  }

  if (consumeError !== undefined && cleanupError !== undefined) {
    throw new AggregateError(
      [consumeError, cleanupError],
      'Download failed and proxy cleanup also failed',
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
    throw new Error(`Unable to determine a safe filename for ${url}`)
  }

  return safeFilename
}
