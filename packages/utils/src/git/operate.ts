import { run, type RunCommandOptions } from '@/cp'

/**
 * 提交 git 信息
 * @param msg 提交信息
 * @param args git commit 参数
 * @param options 可选配置项
 */
export async function gitCommit(
  msg: string,
  args: string[] = [],
  options?: RunCommandOptions,
): Promise<void> {
  try {
    await run('git', ['add', '-A'], options)
    await run('git', ['commit', '-m', msg, ...args], options)
  } catch (error) {
    const err = error as Error
    if (
      err.message.includes('nothing to commit') ||
      /working tree clean/.test(err.message) ||
      /无文件要提交/.test(err.message)
    ) {
      return
    }

    throw new Error(`Git commit failed:\n${err.message}.`)
  }
}

/**
 * 推送 git 到远端
 * @param args git push 参数
 * @param options 可选配置项
 */
export async function gitPush(
  args: string[],
  options?: RunCommandOptions,
): Promise<void> {
  await run('git', ['push', ...args], options)
}

/**
 * git tag
 * @param tag 标签
 * @param args git tag 参数
 * @param options 选项
 */
export async function gitTag(
  tag: string,
  args: string[] = [],
  options?: RunCommandOptions,
): Promise<void> {
  await run('git', ['tag', tag, '-m', tag, ...args], options)
}

/**
 * 同步 git tag 到远端
 * @param tag 标签
 * @param args git push 参数
 * @param options 选项
 */
export async function gitPushTag(
  tag: string,
  args: string[] = [],
  options?: RunCommandOptions,
): Promise<void> {
  await run('git', ['push', 'origin', `refs/tags/${tag}`, ...args], options)
}
