import { PluginAPI } from '@eljs/service'
import { NpmClientEnum, PkgJson, RenderTemplateOptions } from '@eljs/utils'
import { GenerateService, GenerateServicePluginAPI } from './service'

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
