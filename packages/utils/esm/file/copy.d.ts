import { type RenderTemplateOpts } from './render'
/**
 * 文件拷贝选项
 */
export interface CopyFileOpts {
  /**
   * 模板文件路径
   */
  from: string
  /**
   * 目标文件路径
   */
  to: string
  /**
   * 文件基础路径，如果传入会打印日志
   */
  basedir?: string
  /**
   * 模板渲染需要的参数
   */
  data?: Record<string, any>
  /**
   * 渲染引擎的参数
   */
  opts?: RenderTemplateOpts
}
/**
 * 拷贝文件
 * @param opts 文件拷贝选项
 */
export declare function copyFile(opts: CopyFileOpts): void
/**
 * 模版拷贝选项
 */
export interface CopyTplOpts extends CopyFileOpts {
  /**
   * 模板渲染需要的参数
   */
  data: Record<string, any>
}
/**
 * 拷贝模版
 * @param opts 模版拷贝选项
 */
export declare function copyTpl(opts: CopyTplOpts): void
/**
 * 文件夹拷贝选项
 */
export interface CopyDirectoryOpts extends CopyFileOpts {
  /**
   * 模板渲染需要的参数
   */
  data: Record<string, any>
}
/**
 * 拷贝文件夹
 * @param opts 文件夹拷贝选项
 */
export declare function copyDirectory(opts: CopyDirectoryOpts): void
//# sourceMappingURL=copy.d.ts.map
