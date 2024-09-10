/**
 * 是否是 undefined
 * @param target 目标对象
 */
export declare function isUndefined(target: unknown): target is undefined
/**
 * 是否是 Null
 * @param target 目标对象
 */
export declare function isNull(target: unknown): target is undefined
/**
 * 是否是字符串
 * @param target 目标对象
 */
export declare function isString(target: unknown): target is string
/**
 * 是否是对象
 * @param target 目标对象
 */
export declare function isObject<T = Record<string, unknown>>(
  target: unknown,
): target is T
/**
 * 是否是数组
 * @param target 目标对象
 */
export declare function isArray<T = Array<unknown>>(
  target: unknown,
): target is T
/**
 * 是否是函数
 * @param target 目标对象
 */
export declare function isFunction<T = Function>(target: unknown): target is T
/**
 * 是否是布尔值
 * @param target 目标对象
 */
export declare function isBoolean(target: unknown): target is boolean
/**
 * 是否由 Object 扩展的对象
 * @param target 目标对象
 */
export declare function isPlainObject<T = Record<string, unknown>>(
  target: unknown,
): target is T
/**
 * 是否是 Promise 实例
 * @param target 目标对象
 */
export declare function isPromise<T = Promise<unknown>>(
  target: unknown,
): target is T
/**
 * 是否是 Generator 函数
 * @param target 目标对象
 */
export declare function isGeneratorFunction(
  target: unknown,
): target is AsyncGeneratorFunction
/**
 * 是否是 Async 函数
 * @param target 目标对象
 */
export declare function isAsyncFunction(
  target: unknown,
): target is AsyncGeneratorFunction
//# sourceMappingURL=index.d.ts.map
