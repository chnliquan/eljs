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

export function isUndefined(target: unknown): target is undefined {
  return isTypeOf(target, 'undefined')
}

export function isNull(target: unknown): target is undefined {
  return isTypeOf(target, 'null')
}

/**
 * 是否是字符串
 * @param target
 */
export function isString(target: unknown): target is string {
  return isTypeOf(target, 'string')
}

/**
 * 是否是对象
 * @param target
 */
export function isObject<T = Record<string, unknown>>(
  target: unknown,
): target is T {
  return isTypeOf(target, 'Object')
}

/**
 * 是否是数组
 * @param target
 */
export function isArray<T = Array<unknown>>(target: unknown): target is T {
  return isTypeOf(target, 'array')
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function isFunction<T = Function>(target: unknown): target is T {
  return isTypeOf(target, 'function')
}

export function isBoolean(target: unknown): target is boolean {
  return isTypeOf(target, 'boolean')
}

/**
 * 是否由 Object 扩展的对象
 * @param target
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
 * @param target
 */
export function isPromise<T = Promise<unknown>>(target: unknown): target is T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (target && typeof (target as any).then === 'function') as boolean
}

/**
 * 是否是 Generator 函数
 * @param target
 */
export function isGeneratorFunc(
  target: unknown,
): target is AsyncGeneratorFunction {
  return (
    typeof target === 'function' &&
    target.constructor.name === 'GeneratorFunction'
  )
}

/**
 * 是否是 Async 函数
 * @param target
 */
export function isAsyncFunc(target: unknown): target is AsyncGeneratorFunction {
  return (
    typeof target === 'function' && target.constructor.name === 'AsyncFunction'
  )
}
