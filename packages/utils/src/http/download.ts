import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PassThrough, Readable, type Duplex } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { x as extractTar } from 'tar'

/**
 * HTTP 下载操作的返回值
 *
 * @remarks
 * 为兼容历史公开 API，该对象既可作为 Promise 等待完整响应内容，
 * 也可作为双工流消费下载结果
 */
export type DownloadResult = Promise<Buffer> & Duplex

/**
 * 下载资源时使用的选项
 */
export interface DownloadOptions {
  /**
   * 是否将下载内容作为 tar 归档解压到目标目录
   *
   * @defaultValue false
   */
  extract?: boolean

  /**
   * 不解压时写入目标目录的文件名
   *
   * @remarks
   * 最终只使用文件名部分，避免通过相对路径写出目标目录
   */
  filename?: string

  /**
   * HTTP 请求头
   */
  headers?: Headers | Record<string, string> | Array<[string, string]>

  /**
   * 用于主动取消请求的信号
   */
  signal?: AbortSignal

  /**
   * 解压时移除的归档路径层级数
   *
   * @defaultValue 0
   */
  strip?: number

  /**
   * 请求超时时间，单位为毫秒。设置为 `0` 时不启用超时
   *
   * @defaultValue 30000
   */
  timeout?: number
}

/**
 * 下载 HTTP(S) 资源并写入目标目录
 *
 * @param url - 资源地址
 * @param destination - 写入或解压资源的目标目录
 * @param options - 下载选项
 * @returns 可作为 Promise 或双工流消费的下载结果
 * @throws URL 不是 HTTP(S) 协议、请求失败、操作被取消或文件处理失败时抛出错误
 */
export default function download(
  url: string,
  destination?: string,
  options?: DownloadOptions,
): DownloadResult

/**
 * 下载 HTTP(S) 资源并返回完整响应内容
 *
 * @param url - 资源地址
 * @param options - 下载选项
 * @returns 可作为 Promise 或双工流消费的下载结果
 * @throws URL 不是 HTTP(S) 协议、请求失败或操作被取消时抛出错误
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
  const promise = downloadResource(url, destination, options)

  // 保持历史 download API 的行为：既是可读流，也是返回完整内容的 Promise。
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
 * 请求资源，并根据参数返回、写入或解压响应内容
 *
 * @param url - 资源地址
 * @param destination - 可选的目标目录
 * @param options - 下载选项
 * @returns 完整响应内容
 */
async function downloadResource(
  url: string,
  destination: string | undefined,
  options: DownloadOptions,
): Promise<Buffer> {
  const parsedUrl = new URL(url)

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new TypeError(`Unsupported download protocol: ${parsedUrl.protocol}`)
  }

  const timeout = options.timeout ?? 30_000
  const signals = [
    options.signal,
    timeout > 0 ? AbortSignal.timeout(timeout) : undefined,
  ].filter((signal): signal is AbortSignal => Boolean(signal))
  const signal =
    signals.length > 1 ? AbortSignal.any(signals) : (signals.at(0) ?? undefined)
  const response = await fetch(parsedUrl, {
    headers: options.headers,
    redirect: 'follow',
    signal,
  })

  if (!response.ok) {
    throw new Error(
      `Request failed with status ${response.status} ${response.statusText}`,
    )
  }

  const data = Buffer.from(await response.arrayBuffer())

  if (!destination) {
    return data
  }

  await mkdir(destination, { recursive: true })

  if (options.extract) {
    const extractor = extractTar({
      cwd: destination,
      preservePaths: false,
      strict: true,
      strip: options.strip ?? 0,
    })

    await pipeline(Readable.from([data]), extractor)
    return data
  }

  const filename = getSafeFilename(
    options.filename,
    response.url || parsedUrl.href,
  )
  await writeFile(path.join(destination, filename), data)

  return data
}

/**
 * 根据显式文件名或最终响应地址生成安全的文件名
 *
 * @param filename - 调用方指定的文件名
 * @param url - 最终响应地址
 * @returns 不包含目录部分的安全文件名
 * @throws 无法从参数中确定有效文件名时抛出错误
 */
function getSafeFilename(filename: string | undefined, url: string): string {
  const candidate = filename || path.basename(new URL(url).pathname)
  const safeFilename = path.basename(candidate)

  if (!safeFilename || safeFilename === '.' || safeFilename === path.sep) {
    throw new Error(`Unable to determine a safe filename for ${url}`)
  }

  return safeFilename
}
