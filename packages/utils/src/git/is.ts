import execa from 'execa'
import { getGitBranch } from './meta'

/**
 * 指定工作目录的 git 是否干净
 * @param cwd 工作目录
 */
export async function isGitClean(cwd?: string): Promise<boolean> {
  return execa('git', ['status', '--porcelain'], {
    cwd,
  })
    .then(data => {
      return data.stdout.trim().length === 0
    })
    .catch(() => false)
}

/**
 * 指定工作目录的 git 是否落后远程
 * @param cwd 工作目录
 */
export async function isGitBehindRemote(cwd?: string): Promise<boolean> {
  return execa('git', ['fetch'], {
    cwd,
  }).then(() => {
    return execa('git', ['status', '--short', '--branch'], {
      cwd,
    }).then(data => {
      return data.stdout.trim().includes('behind')
    })
  })
}

/**
 * 当前分支是否为传入的分支
 * @param branch 分支名
 * @param cwd 工作目录
 */
export async function isGitBranch(
  branch: string,
  cwd?: string,
): Promise<boolean> {
  const currentBranch = await getGitBranch(cwd)
  return branch === currentBranch
}
