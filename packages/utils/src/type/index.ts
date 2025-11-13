import type {
  AnyAsyncFunction,
  AnyConstructorFunction,
  AnyFunction,
} from '../types'

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
  } catch (err) {
    return false
  }
}

/**
 * 是否为 undefined
 * @param target 目标对象
 */
export function isUndefined(target: unknown): target is undefined {
  return isTypeOf(target, 'undefined')
}

/**
 * 是否为 Null
 * @param target 目标对象
 */
export function isNull(target: unknown): target is undefined {
  return isTypeOf(target, 'null')
}

/**
 * 是否为字符串
 * @param target 目标对象
 */
export function isString(target: unknown): target is string {
  return isTypeOf(target, 'string')
}

/**
 * 是否为对象
 * @param target 目标对象
 */
export function isObject<T = Record<string, unknown>>(
  target: unknown,
): target is T {
  return isTypeOf(target, 'Object')
}

/**
 * 是否为数组
 * @param target 目标对象
 */
export function isArray<T = Array<unknown>>(target: unknown): target is T {
  return isTypeOf(target, 'array')
}

/**
 * 是否为函数（包括异步函数和生成器函数）
 * @param target 目标对象
 */
export function isFunction<T extends AnyFunction = AnyFunction>(
  target: unknown,
): target is T {
  return typeof target === 'function'
}

/**
 * 获取函数构造器（安全方式）
 * @param fn 函数
 * @returns 构造器或null
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
 * 是否为 AsyncGenerator 函数
 * @param target 目标对象
 */
export function isAsyncGeneratorFunction(target: unknown): boolean {
  if (typeof target !== 'function') {
    return false
  }

  const constructor = getFunctionConstructor(target as AnyFunction)
  if (constructor?.name === 'AsyncGeneratorFunction') {
    return true
  }

  // 检查 Object.prototype.toString
  const objectString = Object.prototype.toString.call(target)
  if (objectString === '[object AsyncGeneratorFunction]') {
    return true
  }

  // 字符串检查（编译后的形式）
  const fnString = target.toString()
  return fnString.includes('__asyncGenerator')
}

/**
 * 是否为 Generator 函数
 * @param target 目标对象
 */
export function isGeneratorFunction(
  target: unknown,
): target is GeneratorFunction {
  if (typeof target !== 'function') {
    return false
  }

  // 1. 构造器名检查（最可靠的原生方式）
  const constructor = getFunctionConstructor(target as AnyFunction)
  if (constructor?.name === 'GeneratorFunction') {
    return true
  }

  // 2. Object.prototype.toString 检查
  const objectString = Object.prototype.toString.call(target)
  if (objectString === '[object GeneratorFunction]') {
    return true
  }

  // 3. 字符串模式检查（用于检测编译/转换后的代码）
  const fnString = target.toString()

  // 排除异步生成器函数
  if (isAsyncGeneratorFunction(target)) {
    return false
  }

  // 排除编译后的异步函数（它们内部可能包含 function*）
  if (fnString.includes('__awaiter')) {
    return false
  }

  // 检查是否是真正的生成器函数
  // 生成器函数的模式：function* 或 function *
  return /function\s*\*/.test(fnString)
}

/**
 * 是否为 Async 函数
 * @param target 目标对象
 */
export function isAsyncFunction(target: unknown): target is AnyAsyncFunction {
  if (typeof target !== 'function') {
    return false
  }

  // 1. 构造器名检查（最可靠的原生方式）
  const constructor = getFunctionConstructor(target as AnyFunction)
  if (constructor?.name === 'AsyncFunction') {
    return true
  }

  // 2. Object.prototype.toString 检查
  const objectString = Object.prototype.toString.call(target)
  if (objectString === '[object AsyncFunction]') {
    return true
  }

  // 3. 检查异步生成器函数（它们也是异步的）
  if (isAsyncGeneratorFunction(target)) {
    return true
  }

  // 4. 字符串模式检查（用于检测编译/转换后的代码）
  const fnString = target.toString()

  // 原生异步函数模式
  if (fnString.startsWith('async ') || /^async\s*function/.test(fnString)) {
    return true
  }

  // 异步箭头函数模式
  if (
    /^\s*async\s*\(/.test(fnString) ||
    /^\s*async\s*\w+\s*=>/.test(fnString)
  ) {
    return true
  }

  // TypeScript 编译后的模式（使用 __awaiter helper）
  if (fnString.includes('__awaiter')) {
    return true
  }

  return false
}

/**
 * 是否为布尔值
 * @param target 目标对象
 */
export function isBoolean(target: unknown): target is boolean {
  return isTypeOf(target, 'boolean')
}

/**
 * 是否为 Object 扩展的对象
 * @param target 目标对象
 */
export function isPlainObject(target: unknown): target is object {
  if (!isObject(target)) {
    return false
  }

  const proto = Object.getPrototypeOf(target)

  // 支持 Object.create(null)
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
 * 是否为 Promise 实例
 * @param target 目标对象
 */
export function isPromise<T>(target: unknown): target is Promise<T> {
  return (target &&
    typeof (target as Promise<unknown>).then === 'function') as boolean
}

/**
 * 是否为 es module
 * @param module 模块
 */
export function isESModule<T>(
  module: unknown,
  // eslint-disable-next-line @typescript-eslint/naming-convention
): module is { __esModule: true; default: T } {
  return (
    !!module &&
    typeof module === 'object' &&
    (module as Record<string, unknown>).__esModule === true &&
    'default' in (module as Record<string, unknown>)
  )
}
