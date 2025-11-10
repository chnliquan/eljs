import type { PluginDeclaration, ResolvedPlugin } from '../pluggable'

/**
 * 插件返回类型
 */
export interface PluginReturnType {
  /**
   * 预设定义集合
   */
  presets?: PluginDeclaration[]
  /**
   * 插件定义集合
   */
  plugins?: PluginDeclaration[]
}

/**
 * 解析后的插件返回类型
 */
export interface ResolvedPluginReturnType {
  /**
   * 解析后的预设
   */
  presets?: ResolvedPlugin[]
  /**
   * 解析后的插件
   */
  plugins?: ResolvedPlugin[]
}

/**
 * 插件类型枚举
 */
export enum PluginTypeEnum {
  /**
   * 预设
   */
  Preset = 'preset',
  /**
   * 插件
   */
  Plugin = 'plugin',
}

/**
 * 插件类型
 */
export type PluginType = `${PluginTypeEnum}`

/**
 * 插件是否可执行
 */
export interface Enable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (...args: any[]): boolean
}
