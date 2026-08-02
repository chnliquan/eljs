import type { MaybePromise } from '@eljs/utils/types'
import type { StandardSchemaV1 } from '@standard-schema/spec'

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
   * 插件声明元组第二项使用的参数 Schema
   *
   * @remarks
   * 通过对象形式的 `definePlugin` 或 `definePreset` 定义时由辅助函数附加
   * 宿主会在初始化器执行前完成校验，并把 Schema 输出传给 `options`
   */
  readonly optionsSchema?: StandardSchemaV1

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
