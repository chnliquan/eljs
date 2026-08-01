import type { MaybePromise } from '@eljs/utils'

import type { PluginDeclaration, ResolvedPlugin } from '../core/types'
import type { PluginApi } from './plugin-api'

/**
 * 创建 {@link Plugin} 所需的选项
 */
export interface PluginOptions {
  /**
   * 插件类型
   */
  readonly type: PluginType
  /**
   * 插件根路径
   */
  readonly path: string
  /**
   * 工作目录
   */
  readonly cwd: string
}

/**
 * preset 入口可以返回的嵌套声明
 */
export interface PluginInitializationResult {
  /**
   * 预设定义集合
   */
  presets?: readonly PluginDeclaration[]
  /**
   * 插件定义集合
   */
  plugins?: readonly PluginDeclaration[]
}

/**
 * 插件入口函数契约
 *
 * @typeParam Options - 插件声明元组中第二项的选项类型
 * @typeParam Context - 插件初始化期间可访问的上下文类型
 */
export interface PluginInitializer<
  Options = Record<string, unknown>,
  Context extends PluginApi = PluginApi,
> {
  /**
   * 初始化插件
   *
   * @param context - 当前插件可访问的上下文
   * @param options - 插件声明携带的选项
   * @returns plugin 不返回内容；preset 可以返回嵌套声明
   */
  (
    context: Context,
    options?: Options,
  ): MaybePromise<PluginInitializationResult | undefined | void>
}

/**
 * preset 初始化后解析出的嵌套插件
 */
export interface ResolvedPluginInitializationResult {
  /**
   * 解析后的预设
   */
  presets?: readonly ResolvedPlugin[]
  /**
   * 解析后的插件
   */
  plugins?: readonly ResolvedPlugin[]
}

/**
 * 插件声明类型
 */
export enum PluginKind {
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
 * 插件类型字符串联合
 */
export type PluginType = `${PluginKind}`

/**
 * Hook 是否可执行的静态值或动态判断函数
 */
export type PluginHookEnablement = boolean | (() => boolean)

/**
 * 插件初始化及 Hook 执行指标
 */
export interface PluginExecutionMetrics {
  /**
   * 插件初始化耗时，单位为毫秒
   */
  initializationDurationMs?: number
  /**
   * 插件初始化是否失败
   */
  initializationFailed?: boolean
  /**
   * 各 Hook 最近的执行耗时，单位为毫秒
   */
  hookDurationsMs: Record<string, number[]>
  /**
   * 各 Hook 执行失败次数
   */
  hookErrorCounts: Record<string, number>
}

/**
 * 对外提供的只读插件调试快照
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
   * 插件执行指标快照
   */
  metrics: PluginExecutionMetrics
}

/**
 * 提供给插件代码的只读插件元数据
 */
export interface PluginMetadata {
  /**
   * 插件 ID
   */
  readonly id: string
  /**
   * 插件 key
   */
  readonly key: string
  /**
   * 插件入口路径
   */
  readonly path: string
  /**
   * 插件类型
   */
  readonly type: PluginType
}
