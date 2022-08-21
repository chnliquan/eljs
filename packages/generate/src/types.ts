import { NpmClientEnum } from '@eljs/utils'

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
  uninitialized = 'uninitialized',
  init = 'init',
  initPresets = 'initPresets',
  initPlugins = 'initPlugins',
  prompting = 'prompting',
  collectAppData = 'collectAppData',
  onCheck = 'onCheck',
  onStart = 'onStart',
}
