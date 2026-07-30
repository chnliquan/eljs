import type { Config } from './types/index.js'

export const defaultConfig: Config = {
  /**
   * Working directory
   */
  cwd: process.cwd(),
  /**
   * Whether overwrite existing directory
   */
  force: false,
  /**
   * Whether enable default prompts
   */
  defaultQuestions: true,
  /**
   * Whether initialize git when create done
   */
  gitInit: true,
  /**
   * Whether install dependencies when create done
   */
  install: true,
  /**
   * Whether skip remote template execution confirmation
   */
  yes: false,
  /**
   * Whether allow lifecycle scripts in remote template dependencies
   */
  allowTemplateScripts: false,
}
