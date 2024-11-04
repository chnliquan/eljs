/**
 * 预发布版本
 */
export type Preid = 'alpha' | 'beta' | 'rc'

/**
 * NPM dist tag
 */
export type DistTag = Preid | 'latest'

/**
 * 仓库类型
 */
export type RepoType = 'github' | 'gitlab'

/**
 * 发布选项
 */
export interface Options {
  /**
   * 工作目录
   * @default process.cwd()
   */
  cwd?: string
  /**
   * 预发布版本
   * @default undefined
   */
  preid?: Preid
  /**
   * 是否发布金丝雀版本
   * @default false
   */
  canary?: boolean
  /**
   * 是否生成独立的 git tag
   * @default false
   */
  independent?: boolean
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
   * 是否需要确认发布内容
   * @default true
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
  createRelease?: boolean
  /**
   * 指定发布分支
   */
  branch?: string
  /**
   * 仓库类型
   */
  repoType?: RepoType
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
