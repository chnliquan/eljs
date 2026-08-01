import type { RenderTemplateOptions } from './render'

/**
 * 复制文件和模板时使用的选项
 */
export interface CopyFileOptions {
  /** 复制模式 */
  mode?: number

  /** 文件基础路径，传入时打印相对路径日志 */
  basedir?: string

  /** 模板渲染数据 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>

  /** 渲染引擎选项 */
  renderOptions?: RenderTemplateOptions
}
