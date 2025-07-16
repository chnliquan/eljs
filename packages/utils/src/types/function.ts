/**
 * 空函数
 */
export interface NoopFunction {
  (): void
}

/**
 * 任意函数
 */
export interface AnyFunction {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (...args: any[]): any
}
