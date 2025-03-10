import { run } from '@/cp'
import { tmpdir } from '@/file'
import path from 'node:path'

/**
 * 下载选项
 */
export interface DownloadGitRepoOptions {
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
 * @param options 可选配置项
 */
export async function downloadGitRepo(
  url: string,
  options: DownloadGitRepoOptions = {},
): Promise<string> {
  const { branch = 'master', dest = await tmpdir(true) } = options

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
