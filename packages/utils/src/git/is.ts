import { run, type RunCommandOptions } from '../cp'

/**
 * git 是否干净
 * @param options - 选项
 * @returns Git 工作区是否没有未提交变更
 * @throws 检查期间收到取消信号时抛出取消原因
 */
export async function isGitClean(
  options?: RunCommandOptions,
): Promise<boolean> {
  try {
    const rawStatus = await run('git', ['status', '--porcelain'], options)
    return rawStatus.stdout.trim().length === 0
  } catch (error) {
    if (options?.signal?.aborted) {
      throw options.signal.reason ?? error
    }

    return false
  }
}

/**
 * git 是否落后远程
 * @param options - 选项
 */
export async function isGitBehindRemote(
  options?: RunCommandOptions,
): Promise<boolean> {
  return run('git', ['fetch'], {
    ...options,
    verbose: false,
  }).then(() => {
    return run(
      'git',
      ['status', '--porcelain', '-b', '-u', '--null'],
      options,
    ).then(data => {
      const behindResult = /\[(behind|落后)\s+(\d+)\]/.exec(data.stdout)
      return behindResult?.[2] ? Number(behindResult[2]) > 0 : false
    })
  })
}

/**
 * git 是否超前远程
 * @param options - 选项
 */
export async function isGitAheadRemote(
  options?: RunCommandOptions,
): Promise<boolean> {
  return run('git', ['fetch'], {
    ...options,
    verbose: false,
  }).then(() => {
    return run(
      'git',
      ['status', '--porcelain', '-b', '-u', '--null'],
      options,
    ).then(data => {
      const aheadResult = /\[(ahead|超前)\s+(\d+)\]/.exec(data.stdout)
      return aheadResult?.[2] ? Number(aheadResult[2]) > 0 : false
    })
  })
}
