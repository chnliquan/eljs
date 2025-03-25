import type { UserConfig } from '@eljs/pluggable'

/**
 * Remote template
 */
export interface RemoteTemplate {
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
   * Working directory
   * @default process.cwd()
   */
  cwd?: string
  /**
   * Local template path or remote template
   */
  template?: string | RemoteTemplate
  /**
   * Whether overwrite existing directory
   * @default false
   */
  force?: boolean
  /**
   * Whether enable default prompts
   * @default true
   */
  defaultQuestions?: boolean
  /**
   * Whether initialize git when create done
   * @default true
   */
  gitInit?: boolean
  /**
   * Whether install dependencies when create done
   * @default true
   */
  install?: boolean
}
