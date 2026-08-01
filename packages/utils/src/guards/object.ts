import { isObject } from './basic'

/**
 * 判断目标值是否为普通对象
 *
 * @param target - 目标值
 * @returns 目标值是否为普通对象
 */
export function isPlainObject(target: unknown): target is object {
  if (!isObject(target)) {
    return false
  }

  const proto = Object.getPrototypeOf(target)

  if (proto === null) {
    return true
  }

  let baseProto = proto

  while (Object.getPrototypeOf(baseProto) !== null) {
    baseProto = Object.getPrototypeOf(baseProto)
  }

  return baseProto === proto
}

/**
 * 判断目标值是否为 PromiseLike 对象
 *
 * @param target - 目标值
 * @returns 目标值是否具有可调用的 `then` 方法
 */
export function isPromise<T>(target: unknown): target is Promise<T> {
  return Boolean(
    target && typeof (target as PromiseLike<unknown>).then === 'function',
  )
}

/**
 * 判断目标值是否为包含默认导出的 ES 模块对象
 *
 * @param module - 目标模块
 * @returns 目标值是否为包含默认导出的 ES 模块对象
 */
export function isESModule<T>(
  module: unknown,
): module is { __esModule: true; default: T } {
  return (
    Boolean(module) &&
    typeof module === 'object' &&
    (module as Record<string, unknown>).__esModule === true &&
    'default' in (module as Record<string, unknown>)
  )
}
