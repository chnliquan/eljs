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
 * 是否为函数
 * @param target 目标对象
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export function isFunction<T = Function>(target: unknown): target is T {
  return isTypeOf(target, 'function')
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
 * 是否为 Generator 函数
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
 * 是否为 Async 函数
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
