import type { UserConfig } from '@eljs/pluggable'

/**
 * Template
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
 * Create Configuration
 */
export interface Config extends UserConfig {
  /**
   * Template
   */
  template?: string | Template
  /**
   * Working directory
   * @default process.cwd()
   */
  cwd?: string
  /**
   * Whether override existing directory
   * @default false
   */
  override?: boolean
  /**
   * Whether enable default prompts
   */
  defaultQuestions?: boolean
  /**
   * Whether enable git initialize
   */
  gitInit?: boolean
}
