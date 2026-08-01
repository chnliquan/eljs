import type { UserConfig } from '@eljs/plugin-host'

import type { PrereleaseId } from './npm'

/**
 * GitHub Release 的创建方式
 *
 * @remarks
 * `browser` 打开预填页面供人工确认，`api` 使用令牌直接调用 REST API
 */
export type GithubReleaseMode = 'browser' | 'api'

/**
 * release 用户配置
 */
export interface Config extends UserConfig {
  /**
   * 发布工作目录
   *
   * @remarks
   * 相对路径会在创建运行器时转换为绝对路径，配置文件和 Hook 不能在初始化后切换目录
   * @defaultValue `process.cwd()`
   */
  cwd?: string
  /**
   * 是否仅生成并校验发布计划而不修改项目文件或执行发布
   *
   * @remarks
   * 内置插件保证遵守该值，自定义插件仍会执行并必须自行避免文件写入、
   * 网络发布和其他外部副作用
   *
   * @defaultValue `false`
   */
  dryRun?: boolean
  /**
   * Git 配置
   */
  git?: {
    /**
     * 是否要求 Git 工作区无未提交变更
     * @defaultValue `true`
     */
    requireClean?: boolean
    /**
     * 允许执行发布的 Git 分支
     */
    requireBranch?: string
    /**
     * 更新日志配置，设为 `false` 时不生成更新日志
     * @defaultValue `{ filename: 'CHANGELOG.md', preset: '@eljs/conventional-changelog-preset' }`
     */
    changelog?:
      | false
      | {
          /**
           * 更新日志文件名
           * @defaultValue `CHANGELOG.md`
           */
          filename?: string
          /**
           * 没有可记录变更时写入的占位内容
           * @defaultValue `'**Note:** No changes, only version bump.'`
           */
          placeholder?: string
          /**
           * conventional-changelog 预设模块
           *
           * {@link https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog/README.md#presets}
           */
          preset?: string
        }
    /**
     * 是否为每个 workspace 包生成独立 Git 标签
     * @defaultValue `false`
     */
    independent?: boolean
    /**
     * 是否提交版本和更新日志变更
     * @defaultValue `true`
     */
    commit?: boolean
    /**
     * 发布提交信息模板
     * @defaultValue `"chore: bump version v${version}"`
     */
    commitMessage?: string
    /**
     * 附加到 Git commit 命令的参数
     */
    commitArgs?: string[] | string
    /**
     * 是否将提交和标签推送到远程仓库
     * @defaultValue `true`
     */
    push?: boolean
    /**
     * 附加到 Git push 命令的参数
     * @defaultValue `['--follow-tags']`
     */
    pushArgs?: string[] | string
  }
  /**
   * npm 配置
   */
  npm?: {
    /**
     * npm 仓库地址
     *
     * @remarks
     * 配置后会统一用于版本查询、owner 校验和发布
     */
    registry?: string
    /**
     * 是否要求当前 npm 用户拥有全部待发布包
     * @defaultValue `true`
     */
    requireOwner?: boolean
    /**
     * npm registry 查询的最大并发请求数
     *
     * @remarks
     * 同时限制远程版本查询、版本占用检查和 owner 校验，必须为正整数
     * @defaultValue `8`
     */
    networkConcurrency?: number
    /**
     * 是否进入预发布版本选择流程
     */
    prerelease?: boolean
    /**
     * 预发布版本标识
     *
     * @remarks
     * 必须是可同时用于 semver 首段标识和 npm dist-tag 的单段非数字字符串
     * `latest` 为稳定版本保留，不可作为预发布标识
     */
    prereleaseId?: PrereleaseId
    /**
     * 是否生成包含当前提交信息的 canary 版本
     *
     * @remarks
     * 与 `prereleaseId` 同时配置时，标识必须为 `canary`
     * @defaultValue `false`
     */
    canary?: boolean
    /**
     * 是否在发布前要求确认目标版本
     * @defaultValue `true`
     */
    confirm?: boolean
    /**
     * 附加到 npm publish 命令的参数
     */
    publishArgs?: string | string[]
  }
  /**
   * GitHub 配置
   */
  github?: {
    /**
     * 是否在发布和推送完成后创建 GitHub Release
     * @defaultValue `true`
     */
    release?: boolean
    /**
     * GitHub Release 创建方式
     * @defaultValue `'browser'`
     */
    mode?: GithubReleaseMode
    /**
     * API 模式读取访问令牌的环境变量名
     *
     * @remarks
     * 环境变量中的令牌需要目标仓库 Contents 写权限，配置仅保存变量名而不保存令牌
     * @defaultValue `'GITHUB_TOKEN'`
     */
    tokenEnv?: string
  }
}

/**
 * 完成默认值合并和运行时校验后的 release 配置
 *
 * @remarks
 * 只有具备默认值的字段会变为必填，`requireBranch`、`prereleaseId`
 * 和命令附加参数等未配置字段仍保持可选
 */
export interface ResolvedConfig extends UserConfig {
  /**
   * 绝对工作目录
   */
  cwd: string
  /**
   * 是否处于不修改项目文件和外部发布状态的演练模式
   *
   * @remarks
   * 内置插件保证遵守该值，自定义插件负责在演练模式下跳过自身副作用
   */
  dryRun: boolean
  /**
   * 已解析的 Git 配置
   */
  git: {
    /** 是否要求 Git 工作区无未提交变更 */
    requireClean: boolean
    /** 允许执行发布的 Git 分支 */
    requireBranch?: string
    /** 已解析的更新日志配置，`false` 表示不生成 */
    changelog:
      | false
      | {
          /** 更新日志文件名 */
          filename: string
          /** 没有可记录变更时写入的占位内容 */
          placeholder: string
          /** conventional-changelog 预设模块 */
          preset?: string
        }
    /** 是否为每个 workspace 包生成独立 Git 标签 */
    independent: boolean
    /** 是否提交版本和更新日志变更 */
    commit: boolean
    /** 发布提交信息模板 */
    commitMessage: string
    /** 附加到 Git commit 命令的参数 */
    commitArgs?: string[] | string
    /** 是否将提交和标签推送到远程仓库 */
    push: boolean
    /** 附加到 Git push 命令的参数 */
    pushArgs: string[] | string
  }
  /**
   * 已解析的 npm 配置
   */
  npm: {
    /** npm 仓库地址 */
    registry?: string
    /** 是否要求当前 npm 用户拥有全部待发布包 */
    requireOwner: boolean
    /** npm registry 查询的最大并发请求数 */
    networkConcurrency: number
    /** 是否进入预发布版本选择流程 */
    prerelease?: boolean
    /** 预发布版本标识 */
    prereleaseId?: PrereleaseId
    /** 是否生成包含当前提交信息的 canary 版本 */
    canary: boolean
    /** 是否在发布前要求确认目标版本 */
    confirm: boolean
    /** 附加到 npm publish 命令的参数 */
    publishArgs?: string | string[]
  }
  /**
   * 已解析的 GitHub 配置
   */
  github: {
    /** 是否在发布和推送完成后创建 GitHub Release */
    release: boolean
    /** GitHub Release 创建方式 */
    mode: GithubReleaseMode
    /** API 模式读取访问令牌的环境变量名 */
    tokenEnv: string
  }
}
