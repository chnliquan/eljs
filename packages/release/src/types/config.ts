import type { UserConfig } from '@eljs/pluggable'

import type { PrereleaseId } from './npm'

/**
 * 配置项
 */
export interface Config extends UserConfig {
  /**
   * 项目工作目录
   * @default process.cwd()
   */
  cwd?: string
  /**
   * git 相关配置项
   */
  git?: {
    /**
     * 是否检查工作区
     * @default true
     */
    requireClean?: boolean
    /**
     * 指定发布分支
     */
    requireBranch?: string
    /**
     * 更新日志
     * @default { filename: 'CHANGELOG.md', preset: '@eljs/conventional-changelog-preset' }
     */
    changelog?:
      | false
      | {
          /**
           * 文件名
           * @default CHANGELOG.md
           */
          filename?: string
          /**
           * conventional-changelog 预设
           * @link https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog/README.md#presets
           */
          preset?: string
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
     * commit 信息
     * @default "chore: bump version v${version}"
     */
    commitMessage?: string
    /**
     * git commit 参数
     */
    commitArgs?: string[] | string
    /**
     * 是否推送到远端
     * @default true
     */
    push?: boolean
    /**
     * git push 参数
     * @default ['--follow-tags']
     */
    pushArgs?: string[] | string
  }
  /**
   * npm 相关配置项
   */
  npm?: {
    /**
     * 是否检查用户
     * @default true
     */
    requireOwner?: boolean
    /**
     * 是否预发布
     */
    prerelease?: boolean
    /**
     * 预发布类型
     */
    prereleaseId?: PrereleaseId
    /**
     * 是否发布金丝雀版本
     * @default false
     */
    canary?: boolean
    /**
     * 是否确认版本
     * @default true
     */
    confirm?: boolean
    /**
     * npm publish 参数
     */
    publishArgs?: string | string[]
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
