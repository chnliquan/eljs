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
  'EPUBLISH_PREFLIGHT',
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
  'E402',
  'E403',
  'E404',
  'EOTP',
  'ENEEDAUTH',
  'ENOTLOGGEDIN',
  'ERR_PNPM_FETCH_401',
  'ERR_PNPM_FETCH_402',
  'ERR_PNPM_FETCH_403',
  'ERR_PNPM_FETCH_404',
])

/**
 * 仅读取自身数据属性，拒绝访问器、原型属性及读取失败的代理
 */
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
 * 在有界输出中识别完整白名单代码或状态行，不将原始输出带出信任边界
 *
 * @remarks 每个流最多扫描 16384 个字符、128 行，超过 1024 字符或被截断的行不参与识别
 * stderr 优先于 stdout，行尾自由文本仅用于匹配边界，绝不用于生成诊断
 * 兼容 pnpm 新旧版本的方括号及裸错误码形式，括号必须完整匹配
 */
function outputCode(error: unknown): string | undefined {
  for (const key of ['stderr', 'stdout']) {
    const output = ownValue(error, key)
    if (typeof output !== 'string') {
      continue
    }
    const window = output.slice(0, 16 * 1024)
    const complete =
      output.length > window.length
        ? window.slice(0, window.lastIndexOf('\n') + 1)
        : window
    for (const line of complete.split(/\r?\n/, 128)) {
      if (line.length > 1024) {
        continue
      }
      const code =
        /^[ \t]*npm (?:error|ERR!) code ([A-Z0-9_]{2,40})[ \t]*$/.exec(
          line,
        )?.[1] ??
        /^[ \t\u00a0]*\[(ERR_PNPM_FETCH_(?:401|402|403|404))\](?=[ \t]|$)/.exec(
          line,
        )?.[1] ??
        /^[ \t\u00a0]*(ERR_PNPM_FETCH_(?:401|402|403|404))(?=[ \t]|$)/.exec(
          line,
        )?.[1] ??
        /^[ \t]*npm (?:error|ERR!) (E(?:401|402|403|404))(?=[ \t]|$)/.exec(
          line,
        )?.[1]
      if (code && SAFE_CODES.has(code)) {
        return code
      }
      const status =
        /^[ \t]*npm (?:error|ERR!) (401|402|403|404)(?=[ \t]|$)/.exec(line)?.[1]
      if (status) {
        return `E${status}`
      }
    }
  }
  return undefined
}

/**
 * 仅由白名单代码选择固定恢复提示，避免将输出中的自由文本插入用户日志
 */
function codeHint(code: string): string | undefined {
  switch (code) {
    case 'EPUBLISH_PREFLIGHT':
      return 'Check package manifests, publish access and registry configuration, and dependency order before retrying.'
    case 'EOTP':
      return 'Provide a fresh one-time password (OTP) and retry.'
    case 'E401':
    case 'ENEEDAUTH':
    case 'ENOTLOGGEDIN':
    case 'ERR_PNPM_FETCH_401':
      return 'Check registry authentication and refresh your login or token.'
    case 'E402':
    case 'ERR_PNPM_FETCH_402':
      return 'Check registry billing and package access requirements.'
    case 'E403':
    case 'ERR_PNPM_FETCH_403':
      return 'Check package publish permissions and registry access policy.'
    case 'E404':
    case 'ERR_PNPM_FETCH_404':
      return 'Check the target registry and package availability or access.'
    case 'ETIMEDOUT':
    case 'ECONNREFUSED':
    case 'ECONNRESET':
    case 'ENOTFOUND':
      return 'Check network connectivity and registry availability, then retry.'
    default:
      return undefined
  }
}

/**
 * 创建不引用底层异常的安全命令错误
 *
 * @param error - 可能包含凭据的命令错误或任意取消原因
 * @param canceled - 调用方已知的取消状态，不读取原始取消原因
 * @returns 仅保留白名单错误码、固定提示、数值退出码和取消及超时状态的副本
 * @remarks 自身白名单 code 优先于自身字符串输出，取消优先于超时及代码提示
 * 内置逐包预检使用 EPUBLISH_PREFLIGHT 生成固定诊断，不恢复原始异常消息
 * 不读取访问器、原型、原始消息或 cause 图，重复转换可保留相同诊断
 * @internal
 */
export function createSafeCommandError(
  error: unknown,
  canceled = false,
): SafeCommandError {
  const rawCode = ownValue(error, 'code')
  const code =
    typeof rawCode === 'string' && SAFE_CODES.has(rawCode)
      ? rawCode
      : outputCode(error)
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
  const failure =
    code === 'EPUBLISH_PREFLIGHT'
      ? 'Release publish preflight failed'
      : exitCode !== undefined
        ? `Release command failed (exit code ${exitCode})`
        : code
          ? 'Release command failed'
          : 'Release operation failed'
  const hint = code ? codeHint(code) : undefined
  const message = isCanceled
    ? 'Release command was canceled'
    : timedOut
      ? 'Release command timed out'
      : `${failure}${code ? ` (${code})` : ''}${hint ? `. ${hint}` : ''}`
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
