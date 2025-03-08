import { extname } from 'path'
import { addHook } from 'pirates'

const HOOK_EXTS = ['.ts', '.tsx']

let registered = false
let files: string[] = []
// eslint-disable-next-line @typescript-eslint/no-empty-function
let revert: () => void = () => {}

/**
 * 文件转换实现器
 */
export interface Implementor {
  /**
   * 文件转换函数
   * @param input 源代码
   * @param options 转换选项
   */
  transformSync: (
    input: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: any,
  ) => {
    code: string
  }
}

/**
 * 文件加载器选项
 */
export interface RegisterOptions {
  /**
   * 文件转换实现器
   */
  implementor: Implementor
  /**
   * 是否忽略 node_modules
   */
  ignoreNodeModules?: boolean
  /**
   * 可以识别的文件后缀
   */
  exts?: string[]
}

/**
 * 注册文件加载器
 * @param options 注册选项
 */
export function register(options: RegisterOptions) {
  const { implementor, ignoreNodeModules = true, exts = HOOK_EXTS } = options
  files = []

  if (!registered) {
    revert = addHook(
      (code, filename) => transform(code, filename, implementor),
      {
        exts,
        ignoreNodeModules,
      },
    )
    registered = true
  }
}

/**
 * 获取转换过的文件
 */
export function getFiles() {
  return files
}

/**
 * 清空转换过的文件
 */
export function clearFiles() {
  files = []
}

/**
 * 重置文件加载器
 */
export function restore() {
  revert()
  registered = false
}

function transform(code: string, filename: string, implementor: Implementor) {
  const ext = extname(filename)

  files.push(filename)

  try {
    return implementor.transformSync(code, {
      sourcefile: filename,
      loader: ext.slice(1),
      target: 'es2019',
      format: 'cjs',
      logLevel: 'error',
    }).code
  } catch (e) {
    throw new Error(`Transform file failed: [${filename}].`)
  }
}
