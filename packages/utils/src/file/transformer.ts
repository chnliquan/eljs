import type { AnyFunction, NoopFunction } from '@/types'
import path from 'node:path'
import { addHook } from 'pirates'

/**
 * 转换器构造函数选项
 */
export interface TransformerOptions<T> {
  /**
   * 文件转换函数
   * @param input 源代码
   * @param options 选项
   */
  transform: T
  /**
   * 文件后缀名
   * @default ['.ts']
   */
  exts?: string[]
  /**
   * 忽略 node_modules
   * @default true
   */
  ignoreNodeModules?: boolean
}

/**
 * 转换器类
 */
export class Transformer<T extends AnyFunction> {
  /**
   * 构造函数选项
   */
  public constructorOptions: TransformerOptions<T>

  private _revert: NoopFunction = () => {}

  public constructor(options: TransformerOptions<T>) {
    this.constructorOptions = options
  }

  /**
   * 执行文件劫持
   * @param options 文件转换函数选项
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public apply(options?: Parameters<T>[1]) {
    const { exts = ['.ts'], ignoreNodeModules } = this.constructorOptions
    this._revert = addHook(
      (code, filename) => this._transform(code, filename, (options || {}) as T),
      {
        exts,
        ignoreNodeModules,
      },
    )
  }

  /**
   * 恢复文件劫持
   */
  public revert() {
    this._revert()
  }

  /**
   * 转换文件
   * @param input 源文件内容
   * @param filename 源文件名
   * @param options 文件转换函数选项
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
