import { run, type RunCommandOptions } from '@/cp'

import { isGitAheadRemote, isGitClean } from './is'
import { getGitBranch } from './meta'

/**
 * 提交 git 信息
 * @param msg 提交信息
 * @param options 选项
 */
export async function gitCommit(
  msg: string,
  options?: RunCommandOptions,
): Promise<void> {
  if (await isGitClean(options)) {
    return
  }
  await run('git', ['add', '-A'], options)
  await run('git', ['commit', '-m', msg], options)
}

/**
 * 同步 git commit 到远端
 * @param options 选项
 */
export async function gitPushCommit(
  options?: RunCommandOptions,
): Promise<void> {
  const isAheadRemote = await isGitAheadRemote(options)

  if (!isAheadRemote) {
    return
  }

  const branch = await getGitBranch()

  await run(
    'git',
    ['push', '--follow-tags', '--set-upstream', 'origin', branch],
    options,
  )
}

/**
 * git tag
 * @param tag 标签
 * @param options 选项
 */
export async function gitTag(
  tag: string,
  options?: RunCommandOptions,
): Promise<void> {
  await run('git', ['tag', tag, '-m', tag], options)
}

/**
 * 同步 git tag 到远端
 * @param tag 标签
 * @param options 选项
 */
export async function gitPushTag(
  tag: string,
  options?: RunCommandOptions,
): Promise<void> {
  await run('git', ['push', 'origin', `refs/tags/${tag}`], options)
}
