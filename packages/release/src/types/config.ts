import type { UserConfig } from '@eljs/pluggable'

import type { PrereleaseId } from './npm'

/**
 * 配置项
 */
export interface Config extends UserConfig {
  /**
   * 当前工作目录
   * @default process.cwd()
   */
  cwd?: string
  /**
   * git 相关配置项
   */
  git?: {
    /**
     * 跳过 git 检查
     * @default false
     */
    skipCheck?: boolean
    /**
     * 更新日志
     * @default true
     */
    changelog?: {
      /**
       * 文件名
       * @default CHANGELOG.md
       */
      filename?: string
    }
    /**
     * 是否生成独立的 git tag
     * @default false
     */
    independent?: boolean
    /**
     * 是否提交 commit
     * @default true
     */
    commit?: boolean
    /**
     * 是否推送到远端
     * @default true
     */
    push?: boolean
  }
  /**
   * npm 相关配置项
   */
  npm?: {
    /**
     * 跳过 npm 检查
     * @default false
     */
    skipCheck?: boolean
    /**
     * 是否预发布
     * @default false
     */
    prerelease?: boolean
    /**
     * 预发布类型
     */
    prereleaseId?: PrereleaseId
    /**
     *
     * @default false
     */
    canary?: boolean
    /**
     * 是否同步到 Cnpm
     * @default false
     */
    cnpm?: boolean
    /**
     * 是否确认版本
     * @default true
     */
    confirm?: boolean
  }
  /**
   * github 相关配置项
   */
  github?: {
    /**
     * 是否发布变更
     * @default true
     */
    release?: boolean
  }
}
