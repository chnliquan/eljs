import type { MaybePromise } from '@eljs/utils'

import {
  definePlugin as defineHostPlugin,
  definePreset as defineHostPreset,
  type InitializerWithOptionsSchema,
  type PluginDefinition,
  type PluginInitializationResult,
  type PresetDefinition,
  type StandardSchemaV1,
} from '@eljs/plugin-host'
import type { Config, CreatePluginContext, CreatePresetContext } from './types'

/**
 * 定义 create 配置并保留输入对象的字面量类型
 *
 * @typeParam Input - create 配置输入类型
 * @param config - create 配置
 * @returns 原始配置对象
 */
export function defineConfig<const Input extends Config>(config: Input): Input {
  return config
}

/**
 * 定义能够获得完整 create 上下文类型的插件初始化器
 *
 * @remarks
 * 函数形式会原样返回初始化器，对象形式允许通过 `optionsSchema` 同时声明
 * Schema 输入与输出类型、运行时校验及初始化器接收的解析结果类型
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
>(initializer: Initializer): Initializer
/**
 * 定义带有运行时参数契约的 create 插件初始化器
 *
 * @param definition - 参数 Schema 与 create 插件初始化器
 * @returns 附加只读参数 Schema 的插件初始化器
 */
export function definePlugin<
  Schema extends StandardSchemaV1,
  Result extends MaybePromise<void> = MaybePromise<void>,
>(
  definition: PluginDefinition<Schema, CreatePluginContext, Result>,
): InitializerWithOptionsSchema<Schema, CreatePluginContext, Result>
export function definePlugin(input: unknown): unknown {
  return (defineHostPlugin as (definition: unknown) => unknown)(input)
}

/**
 * 定义能够获得 create preset 上下文类型的初始化器
 *
 * @remarks
 * 单个 preset 可以返回多项嵌套 preset 和 plugin 声明
 * 函数形式会原样返回初始化器，对象形式允许通过 `optionsSchema` 同时声明
 * Schema 输入与输出类型、运行时校验及初始化器接收的解析结果类型
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
>(initializer: Initializer): Initializer
/**
 * 定义带有运行时参数契约的 create preset 初始化器
 *
 * @param definition - 参数 Schema 与 create preset 初始化器
 * @returns 附加只读参数 Schema 的 preset 初始化器
 */
export function definePreset<
  Schema extends StandardSchemaV1,
  Result extends MaybePromise<PluginInitializationResult | void> =
    MaybePromise<PluginInitializationResult | void>,
>(
  definition: PresetDefinition<Schema, CreatePresetContext, Result>,
): InitializerWithOptionsSchema<Schema, CreatePresetContext, Result>
export function definePreset(input: unknown): unknown {
  return (defineHostPreset as (definition: unknown) => unknown)(input)
}
