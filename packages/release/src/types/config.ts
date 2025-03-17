import type { UserConfig } from '@eljs/pluggable'

import type { PrereleaseId } from './npm'

/**
 * 内部使用配置项
 */
export interface InternalConfig extends Config {
  /**
   * 当前工作目录
   * @default process.cwd()
   */
  cwd?: string
}

/**
 * 配置项
 */
export interface Config extends UserConfig {
  /**
   * git 相关配置项
   */
  git?: {
    /**
     * 是否检查工作区干净
     * @default true
     */
    requireClean?: boolean
    /**
     * 指定发布分支
     */
    requireBranch?: string
    /**
     * 更新日志
     * @default true
     */
    changelog?:
      | false
      | {
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
     * 是否跳过检查
     * @default false
     */
    skipChecks?: boolean
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
     * 是否确认版本
     * @default true
     */
    confirm?: boolean
    /**
     * 是否同步到 Cnpm
     * @default false
     */
    cnpm?: boolean
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
