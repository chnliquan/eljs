import { NpmClientEnum } from '@eljs/utils'

export enum ServiceStage {
  Uninitialized = 'uninitialized',
  Init = 'init',
  InitPresets = 'initPresets',
  InitPlugins = 'initPlugins',
  CollectAppData = 'collectAppData',
}

export interface Config {
  [property: string]: any
}

export interface Args {
  _: string[]
  [property: string]: any
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

  [property: string]: any
}

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

  [property: string]: any
}

/**
 * 预设插件提取器
 */
export interface PresetsAndPluginsExtractor {
  (presetsOrPlugins: string[], cwd: string, opts: Record<string, any>): string[]
}

export interface ProxyPluginAPIPropsExtractorReturnType {
  serviceProps: string[]
  staticProps: Record<string, any>
}

export interface PluginReturnType {
  presets?: string[]
  plugins?: string[]
}

export enum PluginType {
  Preset = 'preset',
  Plugin = 'plugin',
}

export enum ApplyPluginsType {
  Add = 'add',
  Modify = 'modify',
  Event = 'event',
}

export enum EnableBy {
  Register = 'register',
  Prompts = 'prompts',
}

export interface ApplyEvent<T> {
  (fn: { (args: T): void }): void
  (args: {
    fn: { (args: T): void }
    name?: string
    before?: string
    stage?: number
  }): void
}

export interface ApplyModify<T, U> {
  (fn: { (initialValue: T, args: U): T }): void
  (fn: { (initialValue: T, args: U): Promise<T> }): void
  (args: {
    fn: { (initialValue: T, args: U): T }
    name?: string
    before?: string
    stage?: number
  }): void
  (args: {
    fn: { (initialValue: T, args: U): Promise<T> }
    name?: string
    before?: string
    stage?: number
  }): void
}

export interface ApplyAdd<T, U> {
  (fn: { (args: T): U | U[] }): void
  (fn: { (args: T): Promise<U | U[]> }): void
  (args: {
    fn: { (args: T): U | U[] }
    name?: string
    before?: string
    stage?: number
  }): void
  (args: {
    fn: {
      (args: T): Promise<U | U[]>
      name?: string
      before?: string
      stage?: number
    }
  }): void
}
