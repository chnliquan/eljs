import type { MaybePromise } from '@eljs/utils'

import type { PluginInitializationResult } from '@eljs/plugin-host'
import type { Config, CreatePluginContext, CreatePresetContext } from './types'

/**
 * 定义 create 配置并保留输入对象类型
 *
 * @param config - create 配置
 * @returns 原始配置对象
 */
export function defineConfig(config: Config): Config {
  return config
}

/**
 * 定义能够获得完整 create 上下文类型的插件初始化器
 *
 * @remarks
 * 该函数只返回原始函数，不包装运行时行为
 *
 * @typeParam Options - 插件声明元组第二项携带的选项类型
 * @typeParam Result - 插件初始化器的同步或异步返回类型
 * @typeParam Initializer - 待定义的插件初始化器函数类型
 * @param initializer - create 插件初始化器
 * @returns 原始插件初始化器
 */
export function definePlugin<
  Options = Record<string, unknown>,
  Result extends MaybePromise<void> = MaybePromise<void>,
  Initializer extends (
    context: CreatePluginContext,
    options?: Options,
  ) => Result = (context: CreatePluginContext, options?: Options) => Result,
>(initializer: Initializer): Initializer {
  return initializer
}

/**
 * 定义能够获得 create preset 上下文类型的初始化器
 *
 * @remarks
 * 单个 preset 可以返回多项嵌套 preset 和 plugin 声明
 * 该函数只返回原始函数，不包装运行时行为
 *
 * @typeParam Options - preset 声明元组第二项携带的选项类型
 * @typeParam Result - preset 初始化器的同步或异步返回类型
 * @typeParam Initializer - 待定义的 preset 初始化器函数类型
 * @param initializer - create preset 初始化器
 * @returns 原始 preset 初始化器
 */
export function definePreset<
  Options = Record<string, unknown>,
  Result extends MaybePromise<PluginInitializationResult | void> =
    MaybePromise<PluginInitializationResult | void>,
  Initializer extends (
    context: CreatePresetContext,
    options?: Options,
  ) => Result = (context: CreatePresetContext, options?: Options) => Result,
>(initializer: Initializer): Initializer {
  return initializer
}
