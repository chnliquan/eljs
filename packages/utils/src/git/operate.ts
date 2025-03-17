import { run, type RunCommandOptions } from '@/cp'

import { getGitBranch } from './meta'

/**
 * 提交 git 信息
 * @param msg 提交信息
 * @param options 可选配置项
 */
export async function gitCommit(
  msg: string,
  options?: RunCommandOptions,
): Promise<void> {
  try {
    await run('git', ['add', '-A'], options)
    await run('git', ['commit', '-m', msg], options)
  } catch (error) {
    const err = error as Error

    if (
      err.message.includes('nothing to commit') ||
      /working tree clean/.test(err.message) ||
      /无文件要提交/.test(err.message)
    ) {
      return
    }

    throw new Error(`Git commit failed: ${err.message}.`)
  }
}

/**
 * 推送 git 到远端
 * @param options 可选配置项
 */
export async function gitPush(options?: RunCommandOptions): Promise<void> {
  const branch = await getGitBranch({
    ...options,
    verbose: false,
  })

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
