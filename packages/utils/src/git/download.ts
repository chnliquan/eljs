import { run } from '@/cp'
import { tmpdir } from '@/file'
import path from 'node:path'

/**
 * 下载选项
 */
export interface DownloadGitRepositoryOptions {
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
 * @param options 选项
 */
export async function downloadGitRepository(
  url: string,
  options?: DownloadGitRepositoryOptions,
): Promise<string> {
  const { branch = 'master', dest = await tmpdir(true) } = options || {}

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
  } catch (error) {
    const err = error as Error
    err.message = `Download ${url} failed: ${err.message}.`
    throw err
  }

  return path.join(dest, 'package')
}
