import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PassThrough, Readable, type Duplex } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { x as extractTar } from 'tar'

export type DownloadResult = Promise<Buffer> & Duplex

export interface DownloadOptions {
  /**
   * Extract the downloaded tar archive into the destination.
   */
  extract?: boolean
  /**
   * Override the filename used when the response is written without extraction.
   */
  filename?: string
  /**
   * HTTP request headers.
   */
  headers?: Headers | Record<string, string> | Array<[string, string]>
  /**
   * Abort signal supplied by the caller.
   */
  signal?: AbortSignal
  /**
   * Number of leading archive path components to remove.
   */
  strip?: number
  /**
   * Request timeout in milliseconds. Set to `0` to disable it.
   *
   * @default 30000
   */
  timeout?: number
}

/**
 * Download an HTTP(S) resource. When a destination is provided, the response
 * is either written to a file or securely extracted as a tar archive.
 */
export default function download(
  url: string,
  destination?: string,
  options?: DownloadOptions,
): DownloadResult
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

  // Keep compatibility with the historical `download` API, which is both a
  // readable stream and a thenable resolving to the complete response body.
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

function getSafeFilename(filename: string | undefined, url: string): string {
  const candidate = filename || path.basename(new URL(url).pathname)
  const safeFilename = path.basename(candidate)

  if (!safeFilename || safeFilename === '.' || safeFilename === path.sep) {
    throw new Error(`Unable to determine a safe filename for ${url}`)
  }

  return safeFilename
}
