/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 无参无返回值的函数形状，用作占位回调与空实现的类型
 */
export interface NoopFunction {
  (): void
}

/**
 * 签名完全放宽的函数形状，用于泛型约束或转发未知回调
 */
export interface AnyFunction {
  (...args: any[]): any
}

/**
 * 产生同步 Generator 的函数形状，用于约束任意生成器工厂
 */
export interface AnyGeneratorFunction {
  (...args: any[]): Generator<any, any, any>
}

/**
 * 返回 Promise 的异步函数形状
 */
export interface AnyAsyncFunction {
  (...args: any[]): Promise<any>
}

/**
 * 产生 AsyncGenerator 的函数形状
 */
export interface AnyAsyncGeneratorFunction {
  (...args: any[]): AsyncGenerator<any, any, any>
}

/**
 * 任意构造函数
 */
export type AnyConstructorFunction = new (...args: any[]) => any
