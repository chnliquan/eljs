import {
  AppData as ServiceAppData,
  PluginAPI,
  PluginConfig,
} from '@eljs/service'
import type { PackageManager, PkgJSON, RenderTemplateOpts } from '@eljs/utils'
import { GenerateService, GenerateServicePluginAPI } from './core/service'

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

export interface CreateOpts {
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
  args?: Record<string, any>
}

export interface AppData extends ServiceAppData {
  /**
   * 当前 Cli 版本
   */
  version: string
  /**
   * 项目名
   */
  projectName: string
  /**
   * 包管理器
   */
  packageManager: PackageManager
}

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
  [property: string]: any
}

export interface GeneratePluginConfig extends PluginConfig {
  /**
   *
   * 是否启用默认问询
   */
  defaultQuestions?: boolean
  /**
   * 是否启用 git 初始化
   */
  gitInit?: boolean
}

export enum GenerateServiceStage {
  // #region service stage
  Uninitialized = 'uninitialized',
  Init = 'init',
  InitPresets = 'initPresets',
  InitPlugins = 'initPlugins',
  CollectAppData = 'collectAppData',
  OnCheck = 'onCheck',
  OnStart = 'onStart',
  // #endregion service stage
  Prompting = 'prompting',
}

export type ExtendPackageOpts = (pkg: PkgJSON) => PkgJSON | PkgJSON

export interface CopyFileOpts {
  /**
   * 模板文件路径
   */
  from: string
  /**
   * 目标文件路径
   */
  to: string
  /**
   * 模板渲染需要的参数
   */
  data?: Record<string, any>
  /**
   * 渲染引擎的参数
   */
  opts?: RenderTemplateOpts
}

/**
 * 拷贝文件选项
 */
export interface CopyTplOpts extends CopyFileOpts {
  /**
   * 模板渲染需要的参数
   */
  data: Record<string, any>
}

/**
 * 拷贝文件夹选项
 */
export interface CopyDirectoryOpts extends CopyFileOpts {
  /**
   * 模板渲染需要的参数
   */
  data: Record<string, any>
}

export type Api = GenerateServicePluginAPI & PluginAPI<GenerateService>
