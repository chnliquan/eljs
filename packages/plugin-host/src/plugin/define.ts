import type { MaybePromise } from '@eljs/utils'

import type { PluginApi } from './plugin-api'
import type { PluginInitializationResult } from './types'

/**
 * 为插件初始化器提供上下文、选项和返回值类型约束
 *
 * @remarks
 * 该函数只返回原始函数，不包装运行时行为
 * 插件初始化器不能返回 preset/plugin 声明
 *
 * @typeParam Options - 插件声明元组第二项携带的选项类型
 * @typeParam Context - 插件初始化期间接收的上下文类型
 * @typeParam Result - 插件初始化器的同步或异步返回类型
 * @typeParam Initializer - 待定义的插件初始化器函数类型
 * @param initializer - 插件初始化器
 * @returns 原始插件初始化器
 */
export function definePlugin<
  Options = Record<string, unknown>,
  Context extends PluginApi = PluginApi,
  Result extends MaybePromise<void> = MaybePromise<void>,
  Initializer extends (context: Context, options?: Options) => Result = (
    context: Context,
    options?: Options,
  ) => Result,
>(initializer: Initializer): Initializer {
  return initializer
}

/**
 * 为 preset 初始化器提供上下文、选项和返回值类型约束
 *
 * @remarks
 * 该函数只返回原始函数，不包装运行时行为
 * 单个 preset 可以返回多项嵌套 preset 和 plugin 声明
 *
 * @typeParam Options - preset 声明元组第二项携带的选项类型
 * @typeParam Context - preset 初始化期间接收的上下文类型
 * @typeParam Result - preset 初始化器的同步或异步返回类型
 * @typeParam Initializer - 待定义的 preset 初始化器函数类型
 * @param initializer - preset 初始化器
 * @returns 原始 preset 初始化器
 */
export function definePreset<
  Options = Record<string, unknown>,
  Context extends PluginApi = PluginApi,
  Result extends MaybePromise<PluginInitializationResult | void> =
    MaybePromise<PluginInitializationResult | void>,
  Initializer extends (context: Context, options?: Options) => Result = (
    context: Context,
    options?: Options,
  ) => Result,
>(initializer: Initializer): Initializer {
  return initializer
}
