import type {
  AnyAsyncFunction,
  AnyConstructorFunction,
  AnyFunction,
} from '../types'
import { isFunction } from './basic'

/**
 * 安全获取函数构造器。
 *
 * @param fn - 目标函数
 * @returns 函数构造器；无法读取时返回 `null`
 */
function getFunctionConstructor(
  fn: AnyFunction,
): AnyConstructorFunction | null {
  try {
    return fn.constructor as AnyConstructorFunction
  } catch {
    return null
  }
}

/**
 * 判断目标值是否为异步生成器函数。
 *
 * @param target - 目标值
 * @returns 目标值是否为异步生成器函数
 */
export function isAsyncGeneratorFunction(target: unknown): boolean {
  if (!isFunction(target)) {
    return false
  }

  const constructor = getFunctionConstructor(target)
  if (constructor?.name === 'AsyncGeneratorFunction') {
    return true
  }

  const objectString = Object.prototype.toString.call(target)
  if (objectString === '[object AsyncGeneratorFunction]') {
    return true
  }

  return target.toString().includes('__asyncGenerator')
}

/**
 * 判断目标值是否为生成器函数。
 *
 * @param target - 目标值
 * @returns 目标值是否为生成器函数
 */
export function isGeneratorFunction(
  target: unknown,
): target is GeneratorFunction {
  if (!isFunction(target)) {
    return false
  }

  const constructor = getFunctionConstructor(target)
  if (constructor?.name === 'GeneratorFunction') {
    return true
  }

  const objectString = Object.prototype.toString.call(target)
  if (objectString === '[object GeneratorFunction]') {
    return true
  }

  const fnString = target.toString()

  if (isAsyncGeneratorFunction(target) || fnString.includes('__awaiter')) {
    return false
  }

  return /function\s*\*/.test(fnString)
}

/**
 * 判断目标值是否为异步函数。
 *
 * @param target - 目标值
 * @returns 目标值是否为异步函数
 */
export function isAsyncFunction(target: unknown): target is AnyAsyncFunction {
  if (!isFunction(target)) {
    return false
  }

  const constructor = getFunctionConstructor(target)
  if (constructor?.name === 'AsyncFunction') {
    return true
  }

  const objectString = Object.prototype.toString.call(target)
  if (objectString === '[object AsyncFunction]') {
    return true
  }

  if (isAsyncGeneratorFunction(target)) {
    return true
  }

  const fnString = target.toString()

  if (fnString.startsWith('async ') || /^async\s*function/.test(fnString)) {
    return true
  }

  if (
    /^\s*async\s*\(/.test(fnString) ||
    /^\s*async\s*\w+\s*=>/.test(fnString)
  ) {
    return true
  }

  return fnString.includes('__awaiter')
}
