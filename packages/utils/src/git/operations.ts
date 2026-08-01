import { run, type RunCommandOptions } from '../cp'
import { isObject } from '../guards'
import { getGitBranch, getGitUpstreamBranch } from './refs'

/**
 * 创建 Git 提交
 * @param message - 提交信息
 * @param options - 命令执行选项
 * @returns 提交完成后结束，没有变更时直接结束
 * @throws Git 命令执行失败时抛出带操作上下文的错误
 */
export async function gitCommit(
  message: string,
  options?: RunCommandOptions,
): Promise<void>
/**
 * 创建 Git 提交
 * @param message - 提交信息
 * @param args - 额外 Git 参数
 * @param options - 命令执行选项
 * @returns 提交完成后结束，没有变更时直接结束
 * @throws Git 命令执行失败时抛出带操作上下文的错误
 */
export async function gitCommit(
  message: string,
  args: string[],
  options?: RunCommandOptions,
): Promise<void>
export async function gitCommit(
  message: string,
  args?: string[] | RunCommandOptions,
  options?: RunCommandOptions,
): Promise<void> {
  if (isObject(args)) {
    options = args
    args = []
  }

  try {
    await run('git', ['add', '-A'], options)
    await run(
      'git',
      ['commit', '-m', message, ...(args ? (args as string[]) : [])],
      options,
    )
  } catch (error) {
    const err = error as Error

    if (
      /nothing to commit/.test(err.message) ||
      /无文件要提交/.test(err.message)
    ) {
      return
    }

    err.message = `Git commit failed: ${err.message}.`
    throw err
  }
}

/**
 * 推送 Git 提交到远端
 * @param options - 命令执行选项
 * @returns 推送完成后结束
 * @throws Git 命令执行失败时抛出带操作上下文的错误
 */
export async function gitPush(options?: RunCommandOptions): Promise<void>
/**
 * 推送 Git 提交到远端
 * @param args - 额外 Git 参数
 * @param options - 命令执行选项
 * @returns 推送完成后结束
 * @throws Git 命令执行失败时抛出带操作上下文的错误
 */
export async function gitPush(
  args: string[],
  options?: RunCommandOptions,
): Promise<void>
export async function gitPush(
  args?: string[] | RunCommandOptions,
  options?: RunCommandOptions,
): Promise<void> {
  if (isObject(args)) {
    options = args
    args = []
  }

  try {
    const upstreamBranch = await getGitUpstreamBranch({
      ...options,
      verbose: false,
    })
    const upstreamArg = !upstreamBranch
      ? [
          '--set-upstream',
          'origin',
          await getGitBranch({
            ...options,
            verbose: false,
          }),
        ]
      : []
    const cliArgs = [
      'push',
      ...(args ? (args as string[]) : []),
      ...upstreamArg,
    ]
    await run('git', cliArgs, options)
  } catch (error) {
    const err = error as Error
    err.message = `Git push failed: ${err.message}`
    throw err
  }
}

/**
 * 创建带注释的 Git 标签
 * @param tagName - 标签名
 * @param options - 命令执行选项
 * @returns 标签创建完成后结束
 * @throws Git 命令执行失败时抛出带操作上下文的错误
 */
export async function gitTag(
  tagName: string,
  options?: RunCommandOptions,
): Promise<void>
/**
 * 创建带注释的 Git 标签
 * @param tagName - 标签名
 * @param args - 额外 Git 参数
 * @param options - 命令执行选项
 * @returns 标签创建完成后结束
 * @throws Git 命令执行失败时抛出带操作上下文的错误
 */
export async function gitTag(
  tagName: string,
  args: string[],
  options?: RunCommandOptions,
): Promise<void>
export async function gitTag(
  tagName: string,
  args?: string[] | RunCommandOptions,
  options?: RunCommandOptions,
): Promise<void> {
  if (isObject(args)) {
    options = args
    args = []
  }

  const cliArgs = [
    'tag',
    tagName,
    '-m',
    tagName,
    ...(args ? (args as string[]) : []),
  ]

  try {
    await run('git', cliArgs, options)
  } catch (error) {
    const err = error as Error
    err.message = `Git Tag failed: ${err.message}`
    throw err
  }
}
