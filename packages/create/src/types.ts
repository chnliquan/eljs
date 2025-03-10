import { Runner, type RunnerPluginApi } from '@/core'
import type { PluginApi } from '@eljs/pluggable'
import type {
  CopyFileOptions,
  PackageJson,
  PackageManager,
  RenderTemplateOptions,
} from '@eljs/utils'

export type TemplateType = 'npm' | 'git' | 'local'

export interface TemplateInfo {
  /**
   * 模板类型
   */
  type: 'npm' | 'git'
  /**
   * 模板描述
   */
  description: string
  /**
   * 模版类型对应值
   */
  value: string
  /**
   * 仓库地址
   */
  registry?: string
}

/**
 * 创建参数
 */
export interface CreateOptions {
  /**
   * 是否直接覆盖文件
   */
  force?: boolean
  /**
   * 模板路径
   */
  template?: string
  /**
   * 模版信息
   */
  templateInfo?: TemplateInfo
  /**
   * 当前路径
   */
  cwd?: string
  /**
   * 命令行参数
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args?: Record<string, any>
}

/**
 * 项目路径
 */
export interface Paths {
  /**
   * 当前执行路径
   */
  cwd: string
  /**
   * 目标路径
   */
  target: string
  /**
   * 扩展字段
   */
  [property: string]: string
}

/**
 * 应用数据
 */
export interface AppData {
  /**
   * 场景
   */
  scene: 'node' | 'web'
  /**
   * 当前 Cli 版本
   */
  cliVersion: string
  /**
   * package.json 对象
   */
  pkg: PackageJson
  /**
   * 项目名
   */
  projectName: string
  /**
   * 包管理器
   */
  packageManager: PackageManager
  /**
   * 扩展字段
   */
  [property: string]: unknown
}

/**
 * 命令行输入
 */
export interface Prompts {
  /**
   * 项目作者
   */
  author: string
  /**
   * 邮箱
   */
  email: string
  /**
   * git url 地址，git@github.com:chnliquan/eljs.git
   */
  gitUrl: string
  /**
   * git href 地址，https://github.com/chnliquan/eljs
   */
  gitHref: string
  /**
   * npm 仓库源
   */
  registry: string
  /**
   * 创建时对应的年，YYYY
   */
  year: string
  /**
   * 创建时对应的日期，YYYY-MM-DD
   */
  date: string
  /**
   * 创建时对应的时间，YYYY-MM-DD hh:mm:ss
   */
  dateTime: string
  /**
   * 创建时使用的文件夹名称
   */
  dirname: string
  /**
   * 扩展字段
   */
  [property: string]: unknown
}

/**
 * 生成器阶段枚举
 */
export enum RunnerStageEnum {
  Uninitialized = 'uninitialized',
  Init = 'init',
  CollectAppData = 'collectAppData',
  OnCheck = 'onCheck',
  OnStart = 'onStart',
  Prompting = 'prompting',
}

/**
 * 插件入参
 */
export type Api = PluginApi<Runner> &
  RunnerPluginApi & {
    // #region 插件工具方法
    /**
     * 拷贝文件
     * @param from 源文件路径
     * @param to 目标文件路径
     * @param options 可选配置项
     */
    copyFile: (
      from: string,
      to: string,
      options: CopyFileOptions,
    ) => Promise<void>
    /**
     * 拷贝模版
     * @param from 源文件路径
     * @param to 目标文件路径
     * @param data 模版数据
     * @param options 可选配置项
     */
    copyTpl: (
      from: string,
      to: string,
      data: object,
      options: CopyFileOptions,
    ) => Promise<void>
    /**
     * 拷贝文件夹
     * @param from 源文件路径
     * @param to 目标文件路径
     * @param data 模版数据
     * @param options 可选配置项
     */
    copyDirectory: (
      from: string,
      to: string,
      data: object,
      options: CopyFileOptions,
    ) => Promise<void>
    /**
     * 渲染模版
     * @param path 模版路径
     * @param data 模版数据
     * @param options 可选配置项
     */
    render: (
      path: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: Record<string, any>,
      options?: RenderTemplateOptions,
    ) => Promise<void>
    /**
     * 扩展 package.json
     * @param partialPkgJson 部分 packageJson 数据
     */
    extendPackage(partialPkgJson: PackageJson): void
    /**
     * 扩展 package.json
     * @param fn packageJson 获取函数
     */
    extendPackage(fn: (memo: PackageJson) => PackageJson): void
    /**
     * 在当前工程下解析一个路径
     * @param paths 文件路径
     */
    resolve: (...paths: string[]) => string
    /**
     * 安装依赖
     */
    installDeps(): Promise<void>
    // #endregion
  }
