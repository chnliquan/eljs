import { run, type RunCommandOptions } from '@/cp'

import { getGitBranch } from './meta'

/**
 * git 是否干净
 * @param options 可选项
 */
export async function isGitClean(
  options?: RunCommandOptions,
): Promise<boolean> {
  return run('git', ['status', '--porcelain'], options)
    .then(data => {
      return data.stdout.trim().length === 0
    })
    .catch(() => false)
}

/**
 * git 是否落后远程
 * @param options 可选项
 */
export async function isGitBehindRemote(
  options?: RunCommandOptions,
): Promise<boolean> {
  return run('git', ['fetch'], options).then(() => {
    return run(
      'git',
      ['status', '--porcelain', '-b', '-u', '--null'],
      options,
    ).then(data => {
      const behindResult = /behind (\d+)/.exec(data.stdout)
      return behindResult?.[1] ? Number(behindResult[1]) > 0 : false
    })
  })
}

/**
 * 指定工作目录的 git 是否超前远程
 * @param options 可选项
 */
export async function isGitAheadRemote(
  options?: RunCommandOptions,
): Promise<boolean> {
  return run('git', ['fetch'], options).then(() => {
    return run(
      'git',
      ['status', '--porcelain', '-b', '-u', '--null'],
      options,
    ).then(data => {
      const aheadResult = /ahead (\d+)/.exec(data.stdout)
      return aheadResult?.[1] ? Number(aheadResult[1]) > 0 : false
    })
  })
}

/**
 * 当前分支是否为传入的分支
 * @param branch 分支名
 * @param options 可选项
 */
export async function isGitBranch(
  branch: string,
  options?: RunCommandOptions,
): Promise<boolean> {
  const currentBranch = await getGitBranch(options)
  return branch === currentBranch
}
