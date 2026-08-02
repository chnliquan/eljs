import { run, type RunCommandOptions } from '@eljs/utils/cp'

/**
 * 判断 Git 标签是否指向当前提交
 *
 * @remarks
 * 标签不存在或 Git 命令执行失败时返回 `false`
 *
 * @param tagName - 待检查的 Git 标签
 * @param options - Git 命令执行选项
 * @returns 标签解析出的提交是否与 HEAD 相同
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
