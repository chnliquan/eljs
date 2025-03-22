import { tmpdir } from '@/file'
import download, { type DownloadOptions } from 'download'
import { EOL } from 'os'

/**
 * 下载 NPM 压缩文件
 * @param url NPM 地址
 * @param dest 目标地址
 * @param options 可选配置项
 */
export async function downloadNpmTarball(
  url: string,
  dest?: string,
  options?: DownloadOptions,
): Promise<string> {
  dest = dest || (await tmpdir(true))
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
    err.message = `Download ${url} failed:${EOL}${err.message}`
    throw err
  }

  return dest
}
