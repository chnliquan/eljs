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
   * Whether overwrite target directory if it exists
   * @default false
   */
  force?: boolean
  /**
   * Whether merge target directory if it exists
   * @default false
   */
  merge?: boolean
  /**
   * Whether enable default prompts
   * @default true
   */
  defaultQuestions?: boolean
  /**
   * Whether initialize git after create done
   * @default true
   */
  gitInit?: boolean
  /**
   * Whether install dependencies after create done
   * @default true
   */
  install?: boolean
}
