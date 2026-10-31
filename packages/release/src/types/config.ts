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
   * 用于取消发布流程、插件子进程和网络请求的信号
   *
   * @remarks
   * 该字段只接受程序化调用方传入，不应序列化到 release 配置文件
   */
  signal?: AbortSignal
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
   * 是否从指向 HEAD 的发布标签发现待重试的版本
   *
   * @remarks
   * 用于发布中断后的重试：目标版本由本地 release 标签决定，
   * 已发布包由 registry 事实驱动跳过
   * 独立模式只匹配当前可发布包的标签，允许部分标签缺失，匹配版本必须唯一
   * 随后仍须校验包版本和已发布冲突，统一模式也拒绝多个不同版本的发布标签
   *
   * @defaultValue `false`
   */
  retry?: boolean
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
           * 工作目录内的更新日志相对路径
           *
           * @remarks 允许普通子目录，拒绝越界、子路径符号链接及 Git 元数据目录
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
     * 附加到包管理器 publish 命令的选项
     *
     * @remarks
     * 不允许位置参数、目录切换、工作区选择或版本改写，以保持实际发布身份与预检一致
     * 限制也适用于多横线、否定前缀及规范化后等价的选项名称
     * 会改变目标的已知别名与缩写同样被拒绝，例如 `--w`、`--ws`、`--C`
     * 不允许覆盖 registry，包含缩写、作用域配置、配置文件切换及 `--config.*` 包装
     * 应使用 `npm.registry` 统一配置发布地址
     * 不允许额外 dry-run 选项及其规范化形式或缩写，顶层 `dryRun` 是唯一预览入口
     * 不允许帮助、用法或版本显示选项及其规范化形式、别名和缩写，防止提前退出被误记为发布成功
     * 未知选项的取值应使用 `--option=value` 形式
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
    /**
     * 允许 API 模式发送令牌的 GitHub Enterprise 主机名
     *
     * @remarks
     * 仅填写不含协议、端口和路径的小写主机名；公共 `github.com` 无需配置
     */
    enterpriseHost?: string
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
   * 是否从指向 HEAD 的发布标签自动发现待重试的版本
   */
  retry: boolean
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
    /** 附加到包管理器 publish 的选项，沿用发布身份、registry 和提前退出限制 */
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
    /** 允许 API 模式发送令牌的 GitHub Enterprise 主机名 */
    enterpriseHost?: string
  }
}
