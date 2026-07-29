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
  /**
   * Whether this template is maintained by a source already trusted by the
   * caller. Trusted templates skip the interactive execution warning.
   * @default false
   */
  trusted?: boolean
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
  /**
   * Skip the interactive warning before executing a remote template.
   * @default false
   */
  yes?: boolean
  /**
   * Allow lifecycle scripts while installing remote template dependencies.
   * @default false
   */
  allowTemplateScripts?: boolean
}
