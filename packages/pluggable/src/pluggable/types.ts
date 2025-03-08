import type { Plugin } from '@/plugin'

/**
 * 插件执行阶段枚举
 */
export enum PluggableStateEnum {
  /**
   * 未初始化
   */
  Uninitialized = 'uninitialized',
  /**
   * 初始化完成
   */
  Init = 'init',
  /**
   * 初始化预设
   */
  InitPresets = 'initPresets',
  /**
   * 初始化插件
   */
  InitPlugins = 'initPlugins',
  /**
   * 加载完成
   */
  Loaded = 'loaded',
}

/**
 * 插件方法集合
 */
export interface PluginMethods {
  [property: string]: {
    /**
     * 插件
     */
    plugin: Plugin
    /**
     * 执行函数
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fn: (...args: any[]) => void
  }
}

/**
 * 执行插件类型枚举
 */
export enum ApplyPluginTypeEnum {
  /**
   * 增加
   */
  Add = 'add',
  /**
   * 修改
   */
  Modify = 'modify',
  /**
   * 事件
   */
  Event = 'event',
}

/**
 * 执行插件参数
 */
export interface ApplyPluginsOptions<T> {
  /**
   * 执行插件类型
   */
  type?: ApplyPluginTypeEnum
  /**
   * 初始化值
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValue?: T
  /**
   * 函数参数
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args?: any
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

export interface ApplyEvent<T> {
  (fn: { (args: T): void }): void
  (args: {
    fn: { (args: T): void }
    name?: string
    before?: string
    stage?: number
  }): void
}
