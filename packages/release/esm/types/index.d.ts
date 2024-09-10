import conventionalChangelog from 'conventional-changelog'
export type ChangelogConfig = conventionalChangelog.Options['config']
export type PublishTag = 'latest' | 'alpha' | 'beta' | 'next'
export type RepoType = 'github' | 'gitlab'
export type Version =
  | 'major'
  | 'minor'
  | 'patch'
  | 'premajor'
  | 'preminor'
  | 'prepatch'
  | 'prerelease'
/**
 * 发布选项
 */
export interface Options {
  /**
   * 工作目录
   */
  cwd?: string
  /**
   * 是否只打印信息
   * @default false
   */
  dry?: boolean
  /**
   * 是否展示详细日志
   * @default false
   */
  verbose?: boolean
  /**
   * 是否生成最新的更新日志
   * @default true
   */
  latest?: boolean
  /**
   * 是否只进行发布
   * @default false
   */
  publishOnly?: boolean
  /**
   * 是否同步到 Cnpm
   * @default false
   */
  syncCnpm?: boolean
  /**
   * 是否需要再次确认
   * @default false
   */
  confirm?: boolean
  /**
   * 是否检查用户发布权限
   * @default true
   */
  ownershipCheck?: boolean
  /**
   * 是否检查 NPM 仓库
   * @default true
   */
  registryCheck?: boolean
  /**
   * 是否检查 git
   * @default true
   */
  gitCheck?: boolean
  /**
   * 是否推送 commit 到远端
   * @default true
   */
  gitPush?: boolean
  /**
   * 是否提交到 github release
   * @default true
   */
  githubRelease?: boolean
  /**
   * 是否检查当前分支
   */
  branch?: string
  /**
   * 自定义 tag
   */
  tag?: PublishTag
  /**
   * 仓库类型
   */
  repoType?: RepoType
  /**
   * 更新日志预设
   * @default '@eljs/changelog-preset'
   */
  changelogPreset?: string
  /**
   * 自定义版本
   */
  version?: string
  /**
   * 更新版本前执行的钩子函数
   * @param version 版本号
   */
  beforeUpdateVersion?: (version: string) => Promise<void>
  /**
   * 生成更新日志前执行的钩子函数
   * @param version 版本号
   */
  beforeChangelog?: () => Promise<void>
}
//# sourceMappingURL=index.d.ts.map
