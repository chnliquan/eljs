import { downloadTo, type DownloadOptions } from '../http/download'

import { createTempDir, remove } from '../file'
import { isObject } from '../guards'

/**
 * 下载并解压 npm tarball 到自动创建的临时目录
 *
 * @param url - npm tarball 地址
 * @param options - 下载选项
 * @returns 解压目录的绝对路径
 * @throws 下载或解压失败时抛出包含 tarball 地址的错误
 */
export async function downloadNpmTarball(
  url: string,
  options?: DownloadOptions,
): Promise<string>

/**
 * 下载并解压 npm tarball 到指定目录
 *
 * @param url - npm tarball 地址
 * @param dest - 解压目标目录
 * @param options - 下载选项
 * @returns 解压目录的绝对路径
 * @throws 下载或解压失败时抛出包含 tarball 地址的错误
 */
export async function downloadNpmTarball(
  url: string,
  dest: string,
  options?: DownloadOptions,
): Promise<string>
export async function downloadNpmTarball(
  url: string,
  dest?: string | DownloadOptions,
  options?: DownloadOptions,
): Promise<string> {
  let ownsDestination = false
  let destination: string

  if (isObject(dest)) {
    options = dest
    destination = await createTempDir(true)
    ownsDestination = true
  } else if (typeof dest === 'string' && dest) {
    destination = dest
  } else {
    destination = await createTempDir(true)
    ownsDestination = true
  }
  const downloadOptions = options ?? {}
  const headers = new Headers(downloadOptions.headers)
  headers.set('accept', 'application/tgz')
  const diagnosticUrl = formatUrlForDiagnostics(url)

  try {
    await downloadTo(url, destination, {
      extract: true,
      strip: 1,
      ...downloadOptions,
      headers,
    })
  } catch (error) {
    if (ownsDestination) {
      try {
        await remove(destination)
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          `Download ${diagnosticUrl} failed and temporary directory cleanup also failed`,
          { cause: cleanupError },
        )
      }
    }

    const err = error as Error
    err.message = `Download ${diagnosticUrl} failed: ${err.message}`
    throw err
  }

  return destination
}

/**
 * 移除下载地址中不应进入日志的认证和签名信息
 *
 * @param url - 原始下载地址
 * @returns 仅保留协议、主机和路径的诊断地址
 * @internal
 */
function formatUrlForDiagnostics(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.username = ''
    parsed.password = ''
    parsed.search = ''
    parsed.hash = ''
    return parsed.href
  } catch {
    return '<invalid URL>'
  }
}
