import { tmpdir } from '@/file'
import download from 'download'

/**
 * 下载 NPM 压缩文件
 * @param url NPM 地址
 * @param dest 目标地址
 * @param options 可选配置项
 */
export async function downloadNpmTarball(
  url: string,
  dest?: string,
  options?: download.DownloadOptions,
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
  } catch (err) {
    throw new Error(`Failed to download ${url}，\n ${err}.`)
  }

  return dest
}
