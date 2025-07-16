import { tmpdir } from '@/file'
import { isObject } from '@/type'
import download, { type DownloadOptions } from 'download'

/**
 * 下载 Npm 压缩包
 * @param url Npm 地址
 * @param options 选项
 */
export async function downloadNpmTarball(
  url: string,
  options?: DownloadOptions,
): Promise<string>
/**
 * 下载 Npm 压缩包
 * @param url Npm 地址
 * @param dest 目标地址
 * @param options 选项
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
