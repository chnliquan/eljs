import type { AnyFunction } from '../types'

/**
 * 判断目标值的内建类型标签是否匹配指定类型
 *
 * @param target - 目标值
 * @param type - 内建类型名称
 * @returns 类型标签是否匹配
 */
function isTypeOf(target: unknown, type: string): boolean {
  if (!type) {
    return false
  }

  try {
    type = type.toLocaleLowerCase()

    if (target === undefined) {
      return type === 'undefined'
    }

    if (target === null) {
      return type === 'null'
    }

    return (
      Object.prototype.toString.call(target).toLocaleLowerCase() ===
      `[object ${type}]`
    )
  } catch {
    return false
  }
}

/**
 * 判断目标值是否为 `undefined`
 *
 * @param target - 目标值
 * @returns 目标值是否为 `undefined`
 */
export function isUndefined(target: unknown): target is undefined {
  return isTypeOf(target, 'undefined')
}

/**
 * 判断目标值是否为 `null`
 *
 * @param target - 目标值
 * @returns 目标值是否为 `null`
 */
export function isNull(target: unknown): target is null {
  return isTypeOf(target, 'null')
}

/**
 * 判断目标值是否为字符串
 *
 * @param target - 目标值
 * @returns 目标值是否为字符串
 */
export function isString(target: unknown): target is string {
  return isTypeOf(target, 'string')
}

/**
 * 判断目标值是否为普通 Object 实例
 *
 * @param target - 目标值
 * @returns 目标值是否为 Object 实例
 */
export function isObject<T = Record<string, unknown>>(
  target: unknown,
): target is T {
  return isTypeOf(target, 'object')
}

/**
 * 判断目标值是否为数组
 *
 * @param target - 目标值
 * @returns 目标值是否为数组
 */
export function isArray<T = Array<unknown>>(target: unknown): target is T {
  return isTypeOf(target, 'array')
}

/**
 * 判断目标值是否为函数
 *
 * @param target - 目标值
 * @returns 目标值是否为函数
 */
export function isFunction<T extends AnyFunction = AnyFunction>(
  target: unknown,
): target is T {
  return typeof target === 'function'
}

/**
 * 判断目标值是否为布尔值
 *
 * @param target - 目标值
 * @returns 目标值是否为布尔值
 */
export function isBoolean(target: unknown): target is boolean {
  return isTypeOf(target, 'boolean')
}
