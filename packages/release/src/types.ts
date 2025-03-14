import type { PluggablePluginApi, PluginApi, UserConfig } from '@eljs/pluggable'
import type { PackageJson, PackageManager } from '@eljs/utils'
import type { Runner, RunnerPluginApi } from './runner'

/**
 * 预发布版本
 */
export type PrereleaseId = 'alpha' | 'beta' | 'rc'

/**
 * npm dist tag
 */
export type DistTag = PrereleaseId | 'latest'

/**
 * 发布选项
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
     * 推送 commit 到远端
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
    syncCnpm?: boolean
  }
  /**
   * github 相关配置项
   */
  github?: {
    /**
     * 创建发布变更
     * @default true
     */
    createRelease?: boolean
  }
}

/**
 * 应用数据
 */
export interface AppData {
  /**
   * 当前 Cli 版本
   */
  cliVersion: string
  /**
   * 仓库源
   */
  registry: string
  /**
   * 项目 package.json 路径
   */
  projectPkgJsonPath: string
  /**
   * 项目 package.json 内容
   */
  projectPkg: Required<PackageJson>
  /**
   * 项目中所有包的 package.json 路径
   */
  pkgJsonPaths: string[]
  /**
   * 项目中所有包的 package.json 内容
   */
  pkgs: Required<PackageJson>[]
  /**
   * 项目中的所有包名
   */
  pkgNames: string[]
  /**
   * 项目中可发布包的路径
   */
  validPkgRootPaths: string[]
  /**
   * 项目中可以发布包的名称
   */
  validPkgNames: string[]
  /**
   * 包管理器
   */
  packageManager: PackageManager
  /**
   * 扩展字段
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [property: string]: any
}

/**
 * 插件 Api
 */
export type Api = PluginApi<Runner> &
  PluggablePluginApi &
  RunnerPluginApi & {
    /**
     * 用户配置项
     */
    userConfig: Config
  }
