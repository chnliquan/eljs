/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 可能为 Promise
 */
export type MaybePromise<T> = PromiseLike<T> | T

/**
 * 可能为 Promise 函数
 */
export type MaybePromiseFunction<T = any> = (
  ...args: any[]
) => PromiseLike<T> | T
