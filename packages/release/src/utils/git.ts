import { run, type RunCommandOptions } from '@eljs/utils'

/**
 * 判断 Git 标签是否指向当前提交
 */
export async function isGitTagAtHead(
  tagName: string,
  options?: RunCommandOptions,
): Promise<boolean> {
  try {
    const tagCommit = await run(
      'git',
      ['rev-list', '-n', '1', tagName],
      options,
    )
    const headCommit = await run('git', ['rev-parse', 'HEAD'], options)

    return (
      tagCommit.stdout.trim().length > 0 &&
      tagCommit.stdout.trim() === headCommit.stdout.trim()
    )
  } catch (error) {
    return false
  }
}
