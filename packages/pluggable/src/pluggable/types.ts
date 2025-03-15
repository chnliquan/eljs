import type { Plugin } from '@/plugin'
import type { MaybePromise } from '@eljs/utils'

/**
 * 插件定义
 */
export type PluginDefinition<T extends object = object> =
  | string
  | string[]
  | [string, T]

/**
 * 解析后的插件定义
 */
export type ResolvedPluginDefinition<T extends object = object> = [
  Plugin,
  T | null,
]

/**
 * 用户配置项
 */
export interface UserConfig {
  /**
   * 预设定义集合
   */
  presets?: PluginDefinition[]
  /**
   * 插件定义集合
   */
  plugins?: PluginDefinition[]
  /**
   * 扩展字段
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [property: string]: any
}

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
   * 获取
   */
  Get = 'get',
  /**
   * 事件
   */
  Event = 'event',
}

/**
 * 执行插件参数
 */
export interface ApplyPluginsOptions<T, U> {
  /**
   * 执行插件类型
   */
  type?: ApplyPluginTypeEnum
  /**
   * 初始化值
   */
  initialValue?: T
  /**
   * 函数参数
   */
  args?: U
}

/**
 * 注册增加类型的函数
 */
export interface ApplyAdd<T, U> {
  (
    fn: { (args: T): MaybePromise<U> },
    options?: { before?: string; stage?: number },
  ): void
}

/**
 * 注册修改类型的函数
 */
export interface ApplyModify<T, U> {
  (
    fn: { (initialValue: T, args: U): MaybePromise<T> },
    options?: { before?: string; stage?: number },
  ): void
}

/**
 * 注册获取类型的函数
 */
export interface ApplyGet<T, U> {
  (
    fn: { (args: T): MaybePromise<U> },
    options?: { before?: string; stage?: number },
  ): void
}

/**
 * 注册事件类型的函数
 */
export interface ApplyEvent<T> {
  (
    fn: { (args: T): MaybePromise<void> },
    options?: { before?: string; stage?: number },
  ): void
}
