import execa from 'execa'

import { run } from '../cp'
import { isGitAheadRemote, isGitClean } from './is'
import { getGitBranch } from './meta'

/**
 * 提交 git 信息
 * @param msg 提交信息
 * @param opts 选项
 */
export async function gitCommit(
  msg: string,
  opts?: execa.Options & {
    verbose?: boolean
  },
): Promise<void> {
  if (await isGitClean(opts?.cwd)) {
    return
  }
  await run('git', ['add', '-A'], opts)
  await run('git', ['commit', '-m', msg], opts)
}

/**
 * 同步 git commit 到远端
 * @param opts 选项
 */
export async function gitPushCommit(
  opts?: execa.Options & {
    verbose?: boolean
  },
): Promise<void> {
  const isAheadRemote = await isGitAheadRemote(opts?.cwd)

  if (!isAheadRemote) {
    return
  }

  const branch = await getGitBranch()

  await run(
    'git',
    ['push', '--follow-tags', '--set-upstream', 'origin', branch],
    opts,
  )
}

/**
 * git tag
 * @param tag 标签
 * @param opts 选项
 */
export async function gitTag(
  tag: string,
  opts?: execa.Options & {
    verbose?: boolean
  },
): Promise<void> {
  await run('git', ['tag', tag, '-m', tag], opts)
}

/**
 * 同步 git tag 到远端
 * @param tag 标签
 * @param opts 选项
 */
export async function gitPushTag(
  tag: string,
  opts?: execa.Options & {
    verbose?: boolean
  },
): Promise<void> {
  await run('git', ['push', 'origin', `refs/tags/${tag}`], opts)
}
