/**
 * 可跨发布错误边界传递的白名单诊断
 *
 * @remarks 不保留原始消息、堆栈、输出、命令、cause 或聚合成员，避免参数与认证信息进入日志
 * @internal
 */
interface SafeCommandError extends Error {
  readonly code?: string
  readonly exitCode?: number
  readonly isCanceled?: boolean
  readonly timedOut?: boolean
}

const SAFE_CODES = new Set([
  'ENOENT',
  'EACCES',
  'EPERM',
  'EAGAIN',
  'ENOMEM',
  'ENOSPC',
  'EIO',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'E401',
  'E403',
  'E404',
  'EOTP',
  'ENEEDAUTH',
  'ENOTLOGGEDIN',
])

function ownValue(error: unknown, key: string): unknown {
  if (
    error === null ||
    (typeof error !== 'object' && typeof error !== 'function')
  ) {
    return undefined
  }
  try {
    return Object.getOwnPropertyDescriptor(error, key)?.value
  } catch {
    return undefined
  }
}

/**
 * 创建不引用底层异常的安全命令错误
 *
 * @param error - 可能包含凭据的命令错误或任意取消原因
 * @param canceled - 调用方已知的取消状态，不读取原始取消原因
 * @returns 仅保留固定错误码、数值退出码和取消状态的副本
 * @internal
 */
export function createSafeCommandError(
  error: unknown,
  canceled = false,
): SafeCommandError {
  const rawCode = ownValue(error, 'code')
  const code =
    typeof rawCode === 'string' && SAFE_CODES.has(rawCode) ? rawCode : undefined
  const rawExitCode = ownValue(error, 'exitCode')
  const exitCode =
    typeof rawExitCode === 'number' && Number.isSafeInteger(rawExitCode)
      ? rawExitCode
      : undefined
  const timedOut =
    ownValue(error, 'timedOut') === true ||
    ownValue(error, 'name') === 'TimeoutError'
  const isCanceled =
    canceled ||
    ownValue(error, 'isCanceled') === true ||
    ownValue(error, 'name') === 'AbortError'
  const message = isCanceled
    ? 'Release command was canceled'
    : timedOut
      ? 'Release command timed out'
      : exitCode !== undefined
        ? `Release command failed (exit code ${exitCode})`
        : code
          ? `Release command failed (${code})`
          : 'Release operation failed'
  return Object.assign(new Error(message), {
    name: isCanceled
      ? 'AbortError'
      : timedOut
        ? 'TimeoutError'
        : 'ReleaseCommandError',
    ...(code ? { code } : {}),
    ...(exitCode !== undefined ? { exitCode } : {}),
    isCanceled,
    timedOut,
  })
}
