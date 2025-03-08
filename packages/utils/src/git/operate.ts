import execa from 'execa'

import { run } from '../cp'
import { isGitAheadRemote, isGitClean } from './is'
import { getGitBranch } from './meta'

/**
 * 提交 git 信息
 * @param msg 提交信息
 * @param options 选项
 */
export async function gitCommit(
  msg: string,
  options?: execa.Options & {
    verbose?: boolean
  },
): Promise<void> {
  if (await isGitClean(options?.cwd)) {
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
  options?: execa.Options & {
    verbose?: boolean
  },
): Promise<void> {
  const isAheadRemote = await isGitAheadRemote(options?.cwd)

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
  options?: execa.Options & {
    verbose?: boolean
  },
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
  options?: execa.Options & {
    verbose?: boolean
  },
): Promise<void> {
  await run('git', ['push', 'origin', `refs/tags/${tag}`], options)
}
