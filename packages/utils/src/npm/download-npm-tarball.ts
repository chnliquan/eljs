import download, { type DownloadOptions } from '../http/download'

import { tmpdir } from '../file'
import { isObject } from '../guards'

/**
 * 下载并解压 npm tarball 到自动创建的临时目录。
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
 * 下载并解压 npm tarball 到指定目录。
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
  if (isObject(dest)) {
    options = dest
    dest = ''
  }

  dest = (dest || (await tmpdir(true))) as string

  try {
    await download(url, dest, {
      extract: true,
      strip: 1,
      headers: {
        accept: 'application/tgz',
      },
      ...options,
    })
  } catch (error) {
    const err = error as Error
    err.message = `Download ${url} failed: ${err.message}`
    throw err
  }

  return dest
}
