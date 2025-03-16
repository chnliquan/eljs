import type { Config } from './types'

export const defaultConfig: Config = {
  /**
   * 当前工作目录
   */
  cwd: process.cwd(),
  /**
   * git 相关配置项
   */
  git: {
    /**
     * 跳过 git 检查
     */
    skipCheck: false,
    /**
     * 更新日志
     */
    changelog: {
      /**
       * 文件名
       */
      filename: 'CHANGELOG.md',
    },
    /**
     * 是否生成独立的 git tag
     */
    independent: false,
    /**
     * 推送 commit 到远端
     */
    push: true,
  },
  /**
   * npm 相关配置项
   */
  npm: {
    /**
     * 跳过 npm 检查
     */
    skipCheck: false,
    /**
     * 是否预发布
     */
    prerelease: false,
    /**
     * 是否发布金丝雀版本
     */
    canary: false,
    /**
     * 是否确认版本
     */
    confirm: true,
    /**
     * 是否同步到 Cnpm
     */
    cnpm: false,
  },
  /**
   * github 相关配置项
   */
  github: {
    /**
     * 创建发布变更
     */
    createRelease: true,
  },
}
