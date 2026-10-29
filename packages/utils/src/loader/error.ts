import { isNativeError } from 'node:util/types'

/**
 * 为加载或转换失败补充上下文，避免不可写错误或非 Error 抛出值掩盖原始原因
 *
 * @remarks
 * 可修改的原生错误保持身份；其他值包装为带 `cause` 的错误，并保留可读取的自有元数据
 *
 * @internal
 */
export function contextualizeError(error: unknown, context: string): Error {
  let detail = 'Unknown error'
  try {
    detail =
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string'
        ? error.message
        : String(error)
  } catch {
    // 自定义字符串转换或属性访问失败时，仍通过 cause 保留原始值
  }

  const message = `${context}: ${detail}`
  if (isNativeError(error)) {
    try {
      error.message = message
      if (error.message === message) {
        return error
      }
    } catch {
      // 冻结错误和只读 message 需要包装，不能让赋值失败覆盖原始错误
    }
  }

  const wrapped = new Error(message, { cause: error })
  if (
    (typeof error === 'object' && error !== null) ||
    typeof error === 'function'
  ) {
    try {
      const descriptors = Object.getOwnPropertyDescriptors(error)
      delete descriptors.message
      delete descriptors.stack
      delete descriptors.cause
      Object.defineProperties(wrapped, descriptors)
      if (isNativeError(error)) {
        Object.defineProperty(wrapped, 'name', {
          value: error.name,
          configurable: true,
          writable: true,
        })
      }
    } catch {
      // 元数据不可访问时，cause 仍保留完整的原始抛出值
    }
  }
  return wrapped
}
