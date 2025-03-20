/**
 * 可能为 Promise
 */
export type MaybePromise<T> = PromiseLike<T> | T

/**
 * 可能为 Promise 函数
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MaybePromiseFunction<T> = (...args: any[]) => PromiseLike<T> | T
