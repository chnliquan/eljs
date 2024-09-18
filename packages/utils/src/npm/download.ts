import download from 'download'

import { tmpdir } from '../file'

/**
 * 下载 NPM 压缩文件
 * @param url NPM 地址
 * @param dest 目标地址
 * @param opts 下载选项
 */
export async function downloadNpmTarball(
  url: string,
  dest = tmpdir(true),
  opts?: download.DownloadOptions,
): Promise<string> {
  try {
    await download(url, dest, {
      extract: true,
      strip: 1,
      headers: {
        accept: 'application/tgz',
      },
      ...opts,
    })
  } catch (err) {
    throw new Error(`Failed to download ${url}，\n ${err}.`)
  }

  return dest
}
