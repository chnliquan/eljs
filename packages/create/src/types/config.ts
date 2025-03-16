import type { UserConfig } from '@eljs/pluggable'

/**
 * 配置项
 */
export interface Config extends UserConfig {
  /**
   * 是否启用默认问询
   */
  defaultQuestions?: boolean
  /**
   * 是否启用 git 初始化
   */
  gitInit?: boolean
}
