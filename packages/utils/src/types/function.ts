/* eslint-disable @typescript-eslint/no-explicit-any */
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
  (...args: any[]): any
}

/**
 * 任意 Generator 函数
 */
export interface AnyGeneratorFunction {
  (...args: any[]): Generator<any, any, any>
}

/**
 * 任意 Async 函数
 */
export interface AnyAsyncFunction {
  (...args: any[]): Promise<any>
}

/**
 * 任意 AsyncGenerator 函数
 */
export interface AnyAsyncGeneratorFunction {
  (...args: any[]): AsyncGenerator<any, any, any>
}

/**
 * 任意构造函数
 */
export type AnyConstructorFunction = new (...args: any[]) => any
