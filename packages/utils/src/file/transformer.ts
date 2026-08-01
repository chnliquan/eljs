import path from 'node:path'
import { addHook } from 'pirates'

import type { AnyFunction, NoopFunction } from '../types'

/**
 * CommonJS 加载时源代码转换器的构造选项
 *
 * @typeParam T - 与底层转换工具兼容的转换函数类型
 */
export interface TransformerOptions<T> {
  /**
   * 文件转换函数
   * @param input - 源代码
   * @param options - 选项
   */
  transform: T
  /**
   * 文件后缀名
   * @defaultValue ['.ts']
   */
  exts?: readonly string[]
  /**
   * 忽略 node_modules
   * @defaultValue true
   */
  ignoreNodeModules?: boolean
}

/**
 * 在受控生命周期内安装 CommonJS 文件转换 Hook
 *
 * @typeParam T - 与底层转换工具兼容的转换函数类型
 */
export class Transformer<T extends AnyFunction> {
  /**
   * 构造函数选项
   */
  public readonly constructorOptions: Readonly<TransformerOptions<T>>

  private _revert: NoopFunction = () => {}

  public constructor(options: TransformerOptions<T>) {
    this.constructorOptions = Object.freeze({
      ...options,
      exts: options.exts ? Object.freeze([...options.exts]) : undefined,
    })
  }

  /**
   * 安装文件转换 Hook
   *
   * @remarks
   * 同一实例重复安装时会先释放旧 Hook，避免全局 `require` 转换器泄漏
   *
   * @param options - 文件转换函数选项
   * @returns 与 {@link Transformer.revert} 等价的幂等释放函数
   */
  public apply(options?: Parameters<T>[1]): NoopFunction {
    this.revert()
    const { exts = ['.ts'], ignoreNodeModules } = this.constructorOptions
    const revertHook = addHook(
      (code, filename) => this._transform(code, filename, (options || {}) as T),
      {
        exts: [...exts],
        ignoreNodeModules,
      },
    )

    let disposed = false
    const dispose = () => {
      if (disposed) {
        return
      }

      disposed = true
      revertHook()

      if (this._revert === dispose) {
        this._revert = () => {}
      }
    }
    this._revert = dispose
    return dispose
  }

  /**
   * 恢复文件劫持
   */
  public revert(): void {
    this._revert()
  }

  /**
   * 转换文件
   * @param input - 源文件内容
   * @param filename - 源文件名
   * @param options - 文件转换函数选项
   */
  private _transform(
    input: string,
    filename: string,
    options: Parameters<T>[1],
  ) {
    const ext = path.extname(filename)

    try {
      const { code } = this.constructorOptions.transform(input, {
        sourcefile: filename,
        loader: ext.slice(1),
        target: 'es2019',
        format: 'cjs',
        logLevel: 'error',
        ...options,
      })
      return code
    } catch (error) {
      const err = error as Error
      err.message = `Transform ${filename} failed: ${err.message}`
      throw err
    }
  }
}
