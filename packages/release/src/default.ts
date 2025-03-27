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
     * 是否检查工作区干净
     */
    requireClean: true,
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
     * 是否提交 commit
     */
    commit: true,
    /**
     * commit 信息
     */
    commitMessage: 'chore: bump version v${version}',
    /**
     * 是否推送到远端
     */
    push: true,
    /**
     * git push 参数
     */
    pushArgs: ['--follow-tags'],
  },
  /**
   * npm 相关配置项
   */
  npm: {
    /**
     * 是否检查用户
     */
    requireOwner: true,
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
    syncCnpm: false,
  },
  /**
   * github 相关配置项
   */
  github: {
    /**
     * 是否创建 github 变更
     */
    release: true,
  },
}
