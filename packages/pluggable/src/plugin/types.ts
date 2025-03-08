/**
 * 插件返回类型
 */
export interface PluginReturnType {
  /**
   * 预设路径集合
   */
  presets?: string[]
  /**
   * 插件路径集合
   */
  plugins?: string[]
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
  (...args: unknown[]): boolean
}
