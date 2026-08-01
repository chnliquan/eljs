import type { UserConfig } from '@eljs/plugin-host'

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
   * caller. Trusted templates skip the interactive execution warning
   * @defaultValue false
   */
  trusted?: boolean
}

/**
 * 项目创建配置
 */
export interface Config extends UserConfig {
  /**
   * Working directory
   * @defaultValue process.cwd()
   */
  cwd?: string
  /**
   * Local template path or remote template
   */
  template?: string | RemoteTemplate
  /**
   * Whether overwrite target directory if it exists
   * @defaultValue false
   */
  force?: boolean
  /**
   * Whether merge target directory if it exists
   * @defaultValue false
   */
  merge?: boolean
  /**
   * Whether enable default prompts
   * @defaultValue true
   */
  defaultQuestions?: boolean
  /**
   * Whether initialize git after create done
   * @defaultValue true
   */
  gitInit?: boolean
  /**
   * Whether install dependencies after create done
   * @defaultValue true
   */
  install?: boolean
  /**
   * Skip the interactive warning before executing a remote template
   * @defaultValue false
   */
  yes?: boolean
  /**
   * Allow lifecycle scripts while installing remote template dependencies
   * @defaultValue false
   */
  allowTemplateScripts?: boolean
}
