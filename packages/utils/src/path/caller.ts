import path from 'node:path'

/**
 * 获取调用方文件所在目录
 * @param stackDepth - 栈深度
 * @returns 调用方文件所在目录
 * @throws 栈深度无效或当前运行时的调用栈格式无法识别时抛出错误
 */
export function getCallerDirectory(stackDepth = 2): string {
  const holder: { stack?: string } = {}
  Error.captureStackTrace(holder)
  const callSite = holder.stack?.split(/\r?\n/u)[stackDepth]

  if (!callSite) {
    throw new RangeError(`Stack depth ${stackDepth} is out of range`)
  }

  const namedStackRegExp = /\s\((.*):\d+:\d+\)$/
  const anonymousStackRegExp = /at (.*):\d+:\d+$/

  let matchResult = callSite.match(namedStackRegExp)

  if (!matchResult) {
    matchResult = callSite.match(anonymousStackRegExp)
  }

  if (!matchResult) {
    throw new Error(`Unable to parse caller from stack entry: ${callSite}`)
  }

  return path.dirname(matchResult[1])
}

/**
 * 获取调用方文件所在目录
 * @param stackDepth - 栈深度
 * @returns 调用方文件所在目录
 * @throws 栈深度无效或当前运行时的调用栈格式无法识别时抛出错误
 * @deprecated 请改用 {@link getCallerDirectory}
 */
export function extractCallDir(stackDepth = 2): string {
  return getCallerDirectory(stackDepth + 1)
}
