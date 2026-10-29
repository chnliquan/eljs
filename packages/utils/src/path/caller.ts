import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 获取调用方文件所在目录
 * @remarks ESM 调用栈中的 file URL 会解码为本地文件系统路径
 * @param stackDepth - 栈深度
 * @returns 调用方文件所在目录
 * @throws 栈深度无效或当前运行时的调用栈格式无法识别时抛出错误
 */
export function getCallerDirectory(stackDepth = 2): string {
  if (!Number.isSafeInteger(stackDepth) || stackDepth < 1) {
    throw new RangeError('Stack depth must be a positive safe integer')
  }
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

  const file = matchResult[1]
  return path.dirname(file.startsWith('file:') ? fileURLToPath(file) : file)
}
