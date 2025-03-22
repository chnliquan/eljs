import { run, type RunCommandOptions } from '@/cp'
import { isObject } from '@/type'
import { EOL } from 'node:os'

import { getGitBranch, getGitUpstreamBranch } from './meta'

/**
 * 提交 git 信息
 * @param message 提交信息
 * @param options 可选配置项
 */
export async function gitCommit(
  message: string,
  options?: RunCommandOptions,
): Promise<void>
/**
 * 提交 git 信息
 * @param message 提交信息
 * @param args 命令行参数
 * @param options 可选配置项
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
      err.message.includes('nothing to commit') ||
      /working tree clean/.test(err.message) ||
      /无文件要提交/.test(err.message)
    ) {
      return
    }

    err.message = `Git commit failed:${EOL}${err.message}.`
    throw err
  }
}

/**
 * 推送 git 到远端
 * @param options 可选配置项
 */
export async function gitPush(options?: RunCommandOptions): Promise<void>
/**
 * 推送 git 到远端
 * @param args 命令行参数
 * @param options 可选配置项
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
    err.message = `Git push failed:${EOL}${err.message}`
    throw err
  }
}

/**
 * git tag
 * @param tagName 标签名
 * @param options 可选配置项
 */
export async function gitTag(
  tagName: string,
  options?: RunCommandOptions,
): Promise<void>
/**
 * git tag
 * @param tagName 标签名
 * @param args 命令行参数
 * @param options 可选配置项
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
    err.message = `Git Tag failed:${EOL}${err.message}`
    throw err
  }
}
