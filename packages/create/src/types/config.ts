import type { UserConfig } from '@eljs/pluggable'

/**
 * Remote Template
 */
export interface RemoteTemplate {
  /**
   * Template type
   */
  type: 'npm' | 'git'
  /**
   * Template value
   */
  value: string
  /**
   * Npm registry
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
