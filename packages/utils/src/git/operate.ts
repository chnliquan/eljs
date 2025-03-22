import { run, type RunCommandOptions } from '@/cp'

import { getGitBranch, getGitUpstreamBranch } from './meta'

/**
 * 提交 git 信息
 * @param message 提交信息
 * @param args 命令行参数
 * @param options 可选配置项
 */
export async function gitCommit(
  message: string,
  args: string[] = [],
  options?: RunCommandOptions,
): Promise<void> {
  try {
    await run('git', ['add', '-A'], options)
    await run('git', ['commit', '-m', message, ...args], options)
  } catch (error) {
    const err = error as Error

    if (
      err.message.includes('nothing to commit') ||
      /working tree clean/.test(err.message) ||
      /无文件要提交/.test(err.message)
    ) {
      return
    }

    err.message = `Git commit failed:\n${err.message}.`
    throw err
  }
}

/**
 * 推送 git 到远端
 * @param args 命令行参数
 * @param options 可选配置项
 */
export async function gitPush(
  args: string[] = [],
  options?: RunCommandOptions,
): Promise<void> {
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
    const cliArgs = ['push', ...args, ...upstreamArg].filter(Boolean)
    await run('git', cliArgs, options)
  } catch (error) {
    const err = error as Error
    err.message = `Git push failed:\n${err.message}`
    throw err
  }
}

/**
 * git tag
 * @param tag 标签
 * @param args 命令行参数
 * @param options 可选配置项
 */
export async function gitTag(
  tag: string,
  args: string[] = [],
  options?: RunCommandOptions,
): Promise<void> {
  try {
    await run('git', ['tag', tag, '-m', tag, ...args], options)
  } catch (error) {
    const err = error as Error
    err.message = `Git Tag failed:\n${err.message}`
    throw err
  }
}
