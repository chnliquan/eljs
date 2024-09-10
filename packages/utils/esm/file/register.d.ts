/**
 * 文件转换实现器
 */
export interface Implementor {
  /**
   * 文件转换函数
   * @param input 源代码
   * @param opts 转换选项
   */
  transformSync: (
    input: string,
    opts: any,
  ) => {
    code: string
  }
}
/**
 * 文件加载器选项
 */
export interface RegisterOpts {
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
 * @param opts 注册选项
 */
export declare function register(opts: RegisterOpts): void
/**
 * 获取转换过的文件
 */
export declare function getFiles(): string[]
/**
 * 清空转换过的文件
 */
export declare function clearFiles(): void
/**
 * 重置文件加载器
 */
export declare function restore(): void
//# sourceMappingURL=register.d.ts.map
