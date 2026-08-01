import type { MaybePromise } from '@eljs/utils'
import type { StandardSchemaV1 } from '@standard-schema/spec'

import { PluginHostError, PluginHostErrorCode } from '../errors'
import { isOptionsSchema } from './options-schema'
import type { PluginApi } from './plugin-api'
import type { PluginInitializationResult } from './types'

/**
 * 携带静态参数 Schema 的初始化器
 *
 * @typeParam Schema - 插件声明参数遵循的 Standard Schema
 * @typeParam Context - 插件初始化期间接收的上下文类型
 * @typeParam Result - 插件或 preset 初始化器返回类型
 */
export type InitializerWithOptionsSchema<
  Schema extends StandardSchemaV1,
  Context,
  Result,
> = ((
  context: Context,
  options: StandardSchemaV1.InferOutput<Schema>,
) => Result) & {
  /**
   * 插件声明元组第二项使用的参数 Schema
   */
  readonly optionsSchema: Schema
}

/**
 * 获取带 Schema 初始化器接受的用户输入类型
 *
 * @typeParam Initializer - 通过对象形式定义的插件或 preset 初始化器
 */
export type InferInitializerOptionsInput<Initializer> = Initializer extends {
  readonly optionsSchema: infer Schema extends StandardSchemaV1
}
  ? StandardSchemaV1.InferInput<Schema>
  : never

/**
 * 获取带 Schema 初始化器接收的解析结果类型
 *
 * @typeParam Initializer - 通过对象形式定义的插件或 preset 初始化器
 */
export type InferInitializerOptionsOutput<Initializer> = Initializer extends {
  readonly optionsSchema: infer Schema extends StandardSchemaV1
}
  ? StandardSchemaV1.InferOutput<Schema>
  : never

/**
 * 通过 Standard Schema 声明参数契约的插件定义
 *
 * @remarks
 * Schema 输入对应插件声明元组第二项，Schema 输出对应初始化器的 `options`
 * Schema 是否接受 `undefined` 决定插件参数能否省略
 *
 * @typeParam Schema - 插件声明参数遵循的 Standard Schema
 * @typeParam Context - 插件初始化期间接收的上下文类型
 * @typeParam Result - 插件初始化器的同步或异步返回类型
 */
export interface PluginDefinition<
  Schema extends StandardSchemaV1,
  Context = PluginApi,
  Result extends MaybePromise<void> = MaybePromise<void>,
> {
  /**
   * 插件声明元组第二项使用的参数 Schema
   */
  readonly optionsSchema: Schema
  /**
   * Schema 校验成功后执行的插件初始化器
   */
  readonly initialize: (
    context: Context,
    options: StandardSchemaV1.InferOutput<Schema>,
  ) => Result
}

/**
 * 通过 Standard Schema 声明参数契约的 preset 定义
 *
 * @remarks
 * Schema 输入对应 preset 声明元组第二项，Schema 输出对应初始化器的 `options`
 * Schema 是否接受 `undefined` 决定 preset 参数能否省略
 *
 * @typeParam Schema - preset 声明参数遵循的 Standard Schema
 * @typeParam Context - preset 初始化期间接收的上下文类型
 * @typeParam Result - preset 初始化器的同步或异步返回类型
 */
export interface PresetDefinition<
  Schema extends StandardSchemaV1,
  Context = PluginApi,
  Result extends MaybePromise<PluginInitializationResult | void> =
    MaybePromise<PluginInitializationResult | void>,
> {
  /**
   * preset 声明元组第二项使用的参数 Schema
   */
  readonly optionsSchema: Schema
  /**
   * Schema 校验成功后执行的 preset 初始化器
   */
  readonly initialize: (
    context: Context,
    options: StandardSchemaV1.InferOutput<Schema>,
  ) => Result
}

function defineInitializer(
  apiName: 'definePlugin' | 'definePreset',
  input: unknown,
): unknown {
  if (typeof input === 'function') {
    return input
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new PluginHostError(
      PluginHostErrorCode.InvalidOptions,
      `${apiName}() expects an initializer function or an object containing optionsSchema and initialize.`,
      { details: { definition: input } },
    )
  }

  const { initialize, optionsSchema } = input as {
    initialize?: unknown
    optionsSchema?: unknown
  }

  if (typeof initialize !== 'function' || !isOptionsSchema(optionsSchema)) {
    throw new PluginHostError(
      PluginHostErrorCode.InvalidOptions,
      `${apiName}() expects initialize to be a function and optionsSchema to implement Standard Schema V1.`,
      {
        details: {
          initializeType: typeof initialize,
          optionsSchema,
        },
      },
    )
  }

  try {
    Object.defineProperty(initialize, 'optionsSchema', {
      configurable: false,
      enumerable: false,
      value: optionsSchema,
      writable: false,
    })
  } catch (error) {
    throw new PluginHostError(
      PluginHostErrorCode.InvalidOptions,
      `${apiName}() could not attach optionsSchema to initialize.`,
      {
        cause: error,
        details: { optionsSchema },
      },
    )
  }

  return initialize
}

/**
 * 为插件初始化器提供上下文、选项和返回值类型约束
 *
 * @remarks
 * 函数形式会原样返回初始化器，对象形式会把 `optionsSchema` 作为只读元数据
 * 附加到初始化器，宿主会在执行初始化器前校验插件声明参数
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
>(initializer: Initializer): Initializer
/**
 * 定义带有运行时参数契约的插件初始化器
 *
 * @param definition - 参数 Schema 与插件初始化器
 * @returns 附加只读参数 Schema 的插件初始化器
 */
export function definePlugin<
  Schema extends StandardSchemaV1,
  Context = PluginApi,
  Result extends MaybePromise<void> = MaybePromise<void>,
>(
  definition: PluginDefinition<Schema, Context, Result>,
): InitializerWithOptionsSchema<Schema, Context, Result>
export function definePlugin(input: unknown): unknown {
  return defineInitializer('definePlugin', input)
}

/**
 * 为 preset 初始化器提供上下文、选项和返回值类型约束
 *
 * @remarks
 * 函数形式会原样返回初始化器，对象形式会把 `optionsSchema` 作为只读元数据
 * 附加到初始化器，宿主会在执行初始化器前校验 preset 声明参数
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
>(initializer: Initializer): Initializer
/**
 * 定义带有运行时参数契约的 preset 初始化器
 *
 * @param definition - 参数 Schema 与 preset 初始化器
 * @returns 附加只读参数 Schema 的 preset 初始化器
 */
export function definePreset<
  Schema extends StandardSchemaV1,
  Context = PluginApi,
  Result extends MaybePromise<PluginInitializationResult | void> =
    MaybePromise<PluginInitializationResult | void>,
>(
  definition: PresetDefinition<Schema, Context, Result>,
): InitializerWithOptionsSchema<Schema, Context, Result>
export function definePreset(input: unknown): unknown {
  return defineInitializer('definePreset', input)
}
