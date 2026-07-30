import type { MaybePromise } from '@eljs/utils'

import type { PluginDeclaration, ResolvedPlugin } from '../pluggable'
import type { PluginApi } from './plugin-api'

/**
 * 插件类构造函数选项
 */
export interface PluginOptions {
  /**
   * 插件类型
   */
  type: PluginType
  /**
   * 插件根路径
   */
  path: string
  /**
   * 工作目录
   */
  cwd: string
}

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
 * 插件入口函数
 */
export interface PluginApply<Options = Record<string, unknown>> {
  (
    api: PluginApi,
    options?: Options,
  ): MaybePromise<PluginReturnType | undefined | void>
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
export type Enable = boolean | (() => boolean)

/**
 * 插件调试耗时
 */
export interface PluginTime {
  /**
   * 插件注册耗时
   */
  register?: number
  /**
   * 各 Hook 最近的执行耗时
   */
  hooks: Record<string, number[]>
  /**
   * 各 Hook 执行失败次数
   */
  hookErrors: Record<string, number>
}

/**
 * 插件调试信息
 */
export interface PluginDiagnostics {
  /**
   * 插件 ID
   */
  id: string
  /**
   * 插件 key
   */
  key: string
  /**
   * 插件入口路径
   */
  path: string
  /**
   * 插件类型
   */
  type: PluginType
  /**
   * 插件耗时和错误统计快照
   */
  time: PluginTime
}
