/**
 * 模版配置
 */
export interface Template {
  /**
   * 模版源类型
   */
  type: 'npm' | 'git'
  /**
   * 模版值
   */
  value: string
  /**
   * 仓库地址
   */
  registry?: string
}

/**
 * 构造函数参数
 */
export interface CreateOptions {
  /**
   * 模板
   */
  template: string | Template
  /**
   * 项目工作目录
   * @default process.cwd()
   */
  cwd?: string
  /**
   * 是否直接覆盖文件
   * @default false
   */
  override?: boolean
}
