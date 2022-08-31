import { TemplateInfo } from '@eljs/create'

export interface CreateTemplateOpts {
  /**
   * 模版配置
   */
  templateConfig: TemplateConfig
  /**
   * 场景类型
   */
  appType?: string
  /**
   * 模版名称
   */
  appName?: string
  /**
   * 是否直接覆盖文件
   */
  force?: boolean
  /**
   * 当前路径
   */
  cwd?: string
}

export interface TemplateConfig {
  /**
   * 模版场景
   */
  appType: Record<string, string>
  /**
   * 模版集合
   */
  templates: Record<string, Record<string, TemplateInfo>>
}
