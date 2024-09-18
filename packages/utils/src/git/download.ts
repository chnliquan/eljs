import path from 'path'
import { run } from '../cp'
import { tmpdir } from '../file'

/**
 * 下载选项
 */
export interface DownloadGitRepoOpts {
  /**
   * 分支
   */
  branch?: string
  /**
   * 目标路径
   */
  dest?: string
}

/**
 * 下载 git 仓库
 * @param url git 地址
 * @param opts 下载选项
 */
export async function downloadGitRepo(
  url: string,
  opts?: DownloadGitRepoOpts,
): Promise<string> {
  const { branch = 'master', dest = tmpdir(true) } = opts || {}

  const args = [
    'git',
    'clone',
    url,
    '-q',
    '-b',
    branch,
    '--depth',
    '1',
    'package',
  ]

  try {
    await run('git', args, {
      cwd: dest,
    })
  } catch (err) {
    throw new Error(`Failed to download ${url}，\n ${err}.`)
  }

  return path.join(dest, 'package')
}
