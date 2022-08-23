import { PluginAPI } from '@eljs/service'
import { NpmClientEnum, PkgJson, RenderTemplateOptions } from '@eljs/utils'
import { GenerateService, GenerateServicePluginAPI } from './service'

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
   * 模版配置（不同场景的多个模版）
   */
  templateConfig?: TemplateConfig
  /**
   * 当前路径
   */
  cwd?: string
  /**
   * 是否生成 schema
   */
  schema?: boolean
}

export interface TemplateConfigWithAppType {
  /**
   * 模版场景
   */
  appType: Record<string, string>
  /**
   * 模版集合
   */
  templates: Record<string, Record<string, TemplateInfo>>
}

export type TemplateConfigWithoutAppType = TemplateInfo[]

export type TemplateConfig =
  | TemplateConfigWithAppType
  | TemplateConfigWithoutAppType

export interface AppData {
  /**
   * 项目名
   */
  projectName?: string
  /**
   * 当前版本
   */
  version?: string
  /**
   * NPM 客户端
   */
  npmClient?: NpmClientEnum
  [key: string]: any
}

export interface Paths {
  /**
   * 当前执行路径
   */
  cwd: string
  /**
   * 项目生成输出路径
   */
  absOutputPath?: string
}

export interface GenerateConfig {
  /**
   * 启用生成成功提示
   */
  generatorDoneTip?: boolean
  /**
   *
   * 启用 默认问询 包含 npm 客户端选择, 项目名称, 描述
   */
  defaultPrompts?: boolean
  /**
   * 启用git 初始化逻辑
   */
  gitInit?: boolean
  [key: string]: any
}

export enum GenerateServiceStage {
  // #region service stage
  Uninitialized = 'uninitialized',
  Init = 'init',
  InitPresets = 'initPresets',
  InitPlugins = 'initPlugins',
  // #endregion service stage
  Prompting = 'prompting',
  CollectAppData = 'collectAppData',
  OnCheck = 'onCheck',
  OnStart = 'onStart',
}

export type ExtendPackageOpts = (pkg: PkgJson) => PkgJson | PkgJson

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
  opts?: RenderTemplateOptions
}

export interface CopyTplOpts extends CopyFileOpts {
  /**
   * 模板渲染需要的参数
   */
  data: Record<string, any>
}

export interface CopyDirectory extends CopyFileOpts {
  /**
   * 模板渲染需要的参数
   */
  data: Record<string, any>
}

export type Api = GenerateServicePluginAPI & PluginAPI<GenerateService>
