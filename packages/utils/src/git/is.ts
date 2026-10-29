import { run, type RunCommandOptions } from '../cp'
import { getCommandTextOutput } from '../cp/command'

/**
 * git 是否干净
 * @remarks 解析入口要求字符串输出，非文本结果视为检查失败并返回 `false`
 * @param options - 选项
 * @returns Git 工作区是否没有未提交变更
 * @throws 检查期间收到取消信号时抛出取消原因
 */
export async function isGitClean(
  options?: RunCommandOptions,
): Promise<boolean> {
  try {
    const rawStatus = await run('git', ['status', '--porcelain'], options)
    return getCommandTextOutput(rawStatus.stdout).trim().length === 0
  } catch (error) {
    if (options?.signal?.aborted) {
      throw options.signal.reason ?? error
    }

    return false
  }
}

/**
 * git 是否落后远程
 * @remarks 先获取远程更新，再检查分支状态；分叉时可同时落后和超前
 * @param options - 选项
 * @throws 状态查询输出不是字符串或 Git 命令执行失败时抛出错误
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
      const behindResult = /(?:\[|,\s*)(behind|落后)\s+(\d+)(?=,|\])/.exec(
        getCommandTextOutput(data.stdout).split(/[\0\n]/, 1)[0],
      )
      return behindResult?.[2] ? Number(behindResult[2]) > 0 : false
    })
  })
}

/**
 * git 是否超前远程
 * @remarks 先获取远程更新，再检查分支状态；分叉时可同时超前和落后
 * @param options - 选项
 * @throws 状态查询输出不是字符串或 Git 命令执行失败时抛出错误
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
      const aheadResult = /(?:\[|,\s*)(ahead|超前)\s+(\d+)(?=,|\])/.exec(
        getCommandTextOutput(data.stdout).split(/[\0\n]/, 1)[0],
      )
      return aheadResult?.[2] ? Number(aheadResult[2]) > 0 : false
    })
  })
}
