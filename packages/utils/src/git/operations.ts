import { run, type RunCommandOptions } from '../cp'
import { isObject } from '../guards'
import { getGitBranch, getGitUpstreamBranch } from './refs'

/**
 * 创建 Git 提交
 * @remarks 仅在提交命令以状态码 1 退出且实际输出表明无变更时忽略错误，提交信息不参与判断
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
 * @remarks 仅在提交命令以状态码 1 退出且实际输出表明无变更时忽略错误，提交信息不参与判断
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
    try {
      await run(
        'git',
        ['commit', '-m', message, ...(args ? (args as string[]) : [])],
        options,
      )
    } catch (error) {
      const result = error as {
        exitCode?: number
        stdout?: unknown
        stderr?: unknown
      }
      const output = [result.stdout, result.stderr]
        .map(commitOutputText)
        .join('\n')

      if (
        !options?.signal?.aborted &&
        result.exitCode === 1 &&
        /^(?:nothing to commit|无文件要提交)(?:[,，]|[ \t]*[（(]|$)/m.test(
          output,
        )
      ) {
        return
      }

      throw error
    }
  } catch (error) {
    const err = error as Error
    err.message = `Git commit failed: ${err.message}.`
    throw err
  }
}

/**
 * 仅从实际命令输出还原诊断文本，兼容二进制和按行输出，不读取含提交参数的错误消息
 */
function commitOutputText(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString('utf8')
  }
  if (Array.isArray(value) && value.every(line => typeof line === 'string')) {
    return value.join('\n')
  }
  return ''
}

/**
 * 推送 Git 提交到远端
 * @remarks 未配置上游且未指定目标时默认推送到 origin 的当前分支；内部查询始终捕获文本，推送保留调用方输出选项
 * @param options - 命令执行选项
 * @returns 推送完成后结束
 * @throws Git 命令执行失败时抛出带操作上下文的错误
 */
export async function gitPush(options?: RunCommandOptions): Promise<void>
/**
 * 推送 Git 提交到远端
 * @remarks 显式仓库或 refspec 原样传递；仅未指定目标且无上游时补充 origin 和当前分支，内部查询独立捕获文本
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
    const pushArgs = args ? (args as string[]) : []
    const queryOptions: RunCommandOptions = {
      ...options,
      verbose: false,
      stdio: undefined,
      stdout: 'pipe',
      stderr: 'pipe',
      buffer: true,
      encoding: 'utf8',
      lines: false,
    }
    const needsDefault =
      !hasPushDestination(pushArgs) &&
      !(await getGitUpstreamBranch(queryOptions))
    const upstreamArg = needsDefault
      ? ['--set-upstream', 'origin', await getGitBranch(queryOptions)]
      : []
    const cliArgs = ['push', ...pushArgs]
    const separatorIndex = cliArgs.indexOf('--')
    cliArgs.splice(
      separatorIndex < 0 ? cliArgs.length : separatorIndex,
      0,
      ...upstreamArg,
    )
    await run('git', cliArgs, options)
  } catch (error) {
    const err = error as Error
    err.message = `Git push failed: ${err.message}`
    throw err
  }
}

/**
 * 识别显式推送目标或批量引用选择，防止默认分支改写调用方的推送范围
 * @remarks 跳过需要独立值的选项，避免把 push-option 或 receive-pack 的值误判为仓库
 * @internal
 */
function hasPushDestination(args: string[]): boolean {
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (
      arg === '--repo' ||
      arg.startsWith('--repo=') ||
      ['--all', '--branches', '--mirror', '--tags'].includes(arg)
    ) {
      return true
    }
    if (arg === '--') {
      return index + 1 < args.length
    }
    if (['-o', '--push-option', '--receive-pack', '--exec'].includes(arg)) {
      index++
    } else if (!arg.startsWith('-')) {
      return true
    }
  }
  return false
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
