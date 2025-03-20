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
 * 是否是 undefined
 * @param target 目标对象
 */
export function isUndefined(target: unknown): target is undefined {
  return isTypeOf(target, 'undefined')
}

/**
 * 是否是 Null
 * @param target 目标对象
 */
export function isNull(target: unknown): target is undefined {
  return isTypeOf(target, 'null')
}

/**
 * 是否是字符串
 * @param target 目标对象
 */
export function isString(target: unknown): target is string {
  return isTypeOf(target, 'string')
}

/**
 * 是否是对象
 * @param target 目标对象
 */
export function isObject<T = Record<string, unknown>>(
  target: unknown,
): target is T {
  return isTypeOf(target, 'Object')
}

/**
 * 是否是数组
 * @param target 目标对象
 */
export function isArray<T = Array<unknown>>(target: unknown): target is T {
  return isTypeOf(target, 'array')
}

/**
 * 是否是函数
 * @param target 目标对象
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export function isFunction<T = Function>(target: unknown): target is T {
  return isTypeOf(target, 'function')
}

/**
 * 是否是布尔值
 * @param target 目标对象
 */
export function isBoolean(target: unknown): target is boolean {
  return isTypeOf(target, 'boolean')
}

/**
 * 是否由 Object 扩展的对象
 * @param target 目标对象
 */
export function isPlainObject<T = Record<string, unknown>>(
  target: unknown,
): target is T {
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
 * 是否是 Promise 实例
 * @param target 目标对象
 */
export function isPromise<T = Promise<unknown>>(target: unknown): target is T {
  return (target &&
    typeof (target as Promise<unknown>).then === 'function') as boolean
}

/**
 * 是否是 Generator 函数
 * @param target 目标对象
 */
export function isGeneratorFunction(
  target: unknown,
): target is AsyncGeneratorFunction {
  return (
    typeof target === 'function' &&
    target.constructor.name === 'GeneratorFunction'
  )
}

/**
 * 是否是 Async 函数
 * @param target 目标对象
 */
export function isAsyncFunction(
  target: unknown,
): target is AsyncGeneratorFunction {
  return (
    typeof target === 'function' && target.constructor.name === 'AsyncFunction'
  )
}

/**
 * 是否是 esm 类型
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
