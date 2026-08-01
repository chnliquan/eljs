import { run, type RunCommandOptions } from '../cp'
import { isObject } from '../guards'

/**
 * 获取当前 Git 分支
 * @param options - 命令执行选项
 * @returns 当前分支名称
 * @throws Git 命令执行失败时抛出错误
 */
export async function getGitBranch(
  options?: RunCommandOptions,
): Promise<string> {
  return run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], options).then(data =>
    data.stdout.trim(),
  )
}

/**
 * 获取当前 Git 上游分支
 * @param options - 命令执行选项
 * @returns 上游分支名称，未配置或查询失败时返回 `null`
 */
export async function getGitUpstreamBranch(
  options?: RunCommandOptions,
): Promise<string | null> {
  try {
    return await run(
      'git',
      ['rev-parse', '--abbrev-ref', '@{u}'],
      options,
    ).then(data => data.stdout.trim())
  } catch {
    return null
  }
}

/**
 * 获取当前 Git 提交哈希
 * @param options - 命令执行选项
 * @returns 完整提交哈希
 * @throws Git 命令执行失败时抛出错误
 */
export async function getGitCommitSha(
  options?: RunCommandOptions,
): Promise<string>
/**
 * 获取当前 Git 提交哈希
 * @param short - 是否返回短哈希
 * @param options - 命令执行选项
 * @returns 提交哈希
 * @throws Git 命令执行失败时抛出错误
 */
export async function getGitCommitSha(
  short: boolean,
  options?: RunCommandOptions,
): Promise<string>
export async function getGitCommitSha(
  short?: boolean | RunCommandOptions,
  options?: RunCommandOptions,
): Promise<string> {
  if (isObject(short)) {
    options = short
    short = false
  }

  const cliArgs = ['rev-parse', ...(short ? ['--short'] : []), 'HEAD']
  return run('git', cliArgs, options).then(data => data.stdout.trim())
}

/**
 * 获取当前 Git 最新标签
 * @param options - 命令执行选项
 * @returns 最新标签，未找到时返回 `null`
 */
export async function getGitLatestTag(
  options?: RunCommandOptions,
): Promise<string | null>
/**
 * 获取当前 Git 最新标签
 * @param match - 标签匹配模式
 * @param options - 命令执行选项
 * @returns 最新标签，未找到时返回 `null`
 */
export async function getGitLatestTag(
  match: string,
  options?: RunCommandOptions,
): Promise<string | null>
/**
 * 获取当前 Git 最新标签
 * @param match - 标签匹配模式
 * @param args - 额外 Git 命令参数
 * @param options - 命令执行选项
 * @returns 最新标签，未找到时返回 `null`
 */
export async function getGitLatestTag(
  match: string,
  args: string[],
  options?: RunCommandOptions,
): Promise<string | null>
export async function getGitLatestTag(
  match?: string | RunCommandOptions,
  args?: string[] | RunCommandOptions,
  options?: RunCommandOptions,
): Promise<string | null> {
  if (isObject(match)) {
    options = match
    args = []
    match = undefined
  }

  if (isObject(args)) {
    options = args
    args = []
  }

  const cliArgs = [
    'describe',
    '--tags',
    '--match',
    (match || '*') as string,
    ...(args ? (args as string[]) : []),
  ]

  try {
    const { stdout } = await run('git', cliArgs, options)
    return stdout.trim()
  } catch {
    return null
  }
}
