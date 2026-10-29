import path from 'node:path'

import { run } from '../cp'
import { UtilsError } from '../error'
import { createTempDir, mkdir, remove } from '../file'

/**
 * 克隆 Git 仓库时使用的选项
 */
export interface CloneGitRepositoryOptions {
  /**
   * 要检出的分支或标签
   *
   * @remarks
   * 显式值优先于仓库地址末尾的 `#ref` 片段
   */
  branch?: string
  /**
   * 目标路径
   */
  dest?: string
  /**
   * 用于终止 Git 子进程的取消信号
   */
  signal?: AbortSignal
}

/**
 * 克隆 Git 仓库
 * @param url - Git 地址
 * @param options - 选项
 * @returns 克隆后的 package 目录
 * @throws 克隆失败时抛出仅含安全诊断字段的 `UtilsError`，取消使用 `ERR_OPERATION_ABORTED`
 * @throws 临时目录清理也失败时抛出包含安全异常的 `AggregateError`
 * @remarks 不保留底层异常的消息、命令、输出或 cause，避免凭据通过日志和序列化泄露
 */
export async function cloneGitRepository(
  url: string,
  options?: CloneGitRepositoryOptions,
): Promise<string> {
  const ownsDestination = !options?.dest
  const {
    branch: explicitBranch,
    dest = await createTempDir(true),
    signal,
  } = options || {}
  const diagnosticSource = formatGitSourceForDiagnostics(url)

  try {
    const { repositoryUrl, branch: fragmentBranch } = parseGitCloneSource(url)
    const branch = explicitBranch ?? fragmentBranch
    const args = ['clone', '--quiet', '--depth', '1']
    if (branch) {
      args.push('--branch', branch)
    }
    // 用户提供的仓库地址必须位于选项终止符之后，避免被 Git 解析为参数
    args.push('--', repositoryUrl, 'package')
    await mkdir(dest)
    await run('git', args, {
      cwd: dest,
      signal,
    })
  } catch (error) {
    const safeError = createSafeGitError(error, diagnosticSource, signal)
    if (ownsDestination) {
      try {
        await remove(dest)
      } catch (cleanupError) {
        const safeCleanupError = createSafeGitError(cleanupError)
        throw new AggregateError(
          [safeError, safeCleanupError],
          `Download ${diagnosticSource} failed and temporary directory cleanup also failed`,
          // eslint-disable-next-line preserve-caught-error -- 原始清理异常可能包含凭据，只保留安全副本
          { cause: safeCleanupError },
        )
      }
    }

    throw safeError
  }

  return path.join(dest, 'package')
}

/**
 * 将不可信的进程或清理异常转换为白名单诊断，不遍历或保留原始异常图
 * @remarks 取消原因同样可能含凭据，仅保留取消分类；清理错误独立转换且不包含路径
 * @param error - 底层异常
 * @param source - 已脱敏的仓库地址，省略时表示清理操作
 * @param signal - 调用方的取消信号
 * @returns 不引用原始异常及其 metadata、cause 或聚合成员的错误
 * @internal
 */
function createSafeGitError(
  error: unknown,
  source?: string,
  signal?: AbortSignal,
): UtilsError {
  const metadata =
    error !== null && typeof error === 'object'
      ? (error as Record<string, unknown>)
      : {}
  const aborted =
    signal?.aborted ||
    metadata.isCanceled === true ||
    metadata.name === 'AbortError' ||
    metadata.name === 'TimeoutError'
  const exitCode = metadata.exitCode
  const errno = metadata.code
  const code = aborted
    ? 'ERR_OPERATION_ABORTED'
    : Number.isSafeInteger(exitCode)
      ? 'ERR_PROCESS_EXIT'
      : 'ERR_PROCESS_SPAWN'
  return new UtilsError(
    code,
    source
      ? `Download ${source} failed (${code})`
      : 'Git download cleanup failed',
    {
      details: {
        ...(source ? { source } : {}),
        ...(typeof exitCode === 'number' && Number.isSafeInteger(exitCode)
          ? { exitCode }
          : {}),
        ...(typeof errno === 'string' &&
        [
          'ENOENT',
          'EACCES',
          'EPERM',
          'EAGAIN',
          'ENOMEM',
          'ENOSPC',
          'EIO',
        ].includes(errno)
          ? { errno }
          : {}),
        ...(typeof metadata.timedOut === 'boolean'
          ? { timedOut: metadata.timedOut }
          : {}),
      },
      operation: source ? 'git.clone' : 'git.clone.cleanup',
    },
  )
}

/**
 * 生成不包含凭据、查询参数和片段的 Git 地址诊断值
 *
 * @param source - 用户提供的 Git 地址
 * @returns 可安全写入日志的地址
 * @internal
 */
function formatGitSourceForDiagnostics(source: string): string {
  try {
    const parsed = new URL(source.replace(/^git\+(?=https?:|ssh:)/u, ''))
    if (
      !['http:', 'https:', 'ssh:', 'git:', 'file:'].includes(parsed.protocol)
    ) {
      return '<non-URL Git source>'
    }
    parsed.username = ''
    parsed.password = ''
    parsed.search = ''
    parsed.hash = ''
    return parsed.href
  } catch {
    return '<non-URL Git source>'
  }
}

/**
 * 将 npm 风格的 Git 地址转换为 `git clone` 可接受的仓库地址和可选 ref
 *
 * @remarks
 * `git+https` 等前缀只用于包管理器声明，原生 Git 不接受该协议名；URL
 * 片段约定为待检出的分支或标签，不能继续传给远端服务器
 *
 * @param source - 用户提供的 Git 模板地址
 * @returns 规范化仓库地址和地址片段声明的分支或标签
 */
function parseGitCloneSource(source: string): {
  repositoryUrl: string
  branch?: string
} {
  const hashIndex = source.lastIndexOf('#')
  const fragment = hashIndex >= 0 ? source.slice(hashIndex + 1).trim() : ''
  const sourceWithoutFragment =
    hashIndex >= 0 ? source.slice(0, hashIndex) : source
  const repositoryUrl = sourceWithoutFragment.replace(
    /^git\+(?=https?:|ssh:)/u,
    '',
  )

  return {
    repositoryUrl,
    ...(fragment ? { branch: decodeURIComponent(fragment) } : {}),
  }
}
