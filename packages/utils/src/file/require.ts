import type { Noop } from '@/types'
import path from 'node:path'
import { addHook } from 'pirates'

/**
 * 转换器
 */
export interface Transformer {
  /**
   * 文件转换函数
   * @param code 源代码
   * @param options 选项
   */
  transformSync: (
    input: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: Record<string, any>,
  ) => {
    code: string
  }
}

/**
 * 加载器构造函数选项
 */
export interface RegisterOptions {
  /**
   * 转换器，推荐使用 esbuild、@babel/core
   */
  transformer: Transformer
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
 * 加载器类
 */
export class Require {
  /**
   * 构造函数选项
   */
  public constructorOptions: RegisterOptions

  private _revert: Noop = () => {}

  public constructor(options: RegisterOptions) {
    this.constructorOptions = options
  }

  /**
   * 执行文件劫持
   * @param options 文件转换函数选项
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public apply(options?: Record<string, any>) {
    const { exts = ['.ts'], ignoreNodeModules } = this.constructorOptions
    this._revert = addHook(
      (code, filename) => this._transform(code, filename, options || {}),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: Record<string, any>,
  ) {
    const ext = path.extname(filename)

    try {
      const { code } = this.constructorOptions.transformer.transformSync(
        input,
        {
          sourcefile: filename,
          loader: ext.slice(1),
          target: 'es2019',
          format: 'cjs',
          logLevel: 'error',
          ...options,
        },
      )
      return code
    } catch (error) {
      const err = error as Error
      err.message = `Transform ${filename} failed: ${err.message}`
      throw err
    }
  }
}
