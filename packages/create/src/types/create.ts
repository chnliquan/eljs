export type TemplateType = 'npm' | 'git' | 'local'

export interface TemplateInfo {
  /**
   * 模板类型
   */
  type: 'npm' | 'git'
  /**
   * 模板描述
   */
  description: string
  /**
   * 模版类型对应值
   */
  value: string
  /**
   * 仓库地址
   */
  registry?: string
}

/**
 * 创建参数
 */
export interface CreateOptions {
  /**
   * 是否直接覆盖文件
   */
  force?: boolean
  /**
   * 模板路径
   */
  template?: string
  /**
   * 模版信息
   */
  templateInfo?: TemplateInfo
  /**
   * 当前路径
   */
  cwd?: string
  /**
   * 命令行参数
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args?: Record<string, any>
}
