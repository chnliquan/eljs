import type { MaybePromise } from '@eljs/utils/types'

import { HookKind, type LooseHookRunOptions } from '../core/types'

/**
 * Hook 的执行顺序配置
 */
export interface HookRegistrationOptions {
  /**
   * 在指定插件的 Hook 之前执行
   */
  before?: string
  /**
   * 执行阶段，数值越小越早执行
   */
  stage?: number
}

/**
 * 描述一个 Hook 的执行方式及其类型契约
 *
 * @remarks
 * `Args` 和 `Value` 仅用于类型推导，不会写入运行时对象
 *
 * @typeParam Kind - Hook 的执行类型
 * @typeParam Args - 传递给 Hook 处理函数的参数类型
 * @typeParam Value - Hook 聚合、修改或返回的值类型
 */
export interface HookDefinition<
  Kind extends HookKind = HookKind,
  Args = unknown,
  Value = unknown,
> {
  /**
   * Hook 执行类型
   */
  readonly kind: Kind
  /**
   * 仅用于携带编译期类型的占位字段
   *
   * @internal
   */
  readonly __types__?: {
    /**
     * Hook 参数类型
     */
    args: Args
    /**
     * Hook 值类型
     */
    value: Value
  }
}

/**
 * 以 Hook 名称为键的 Hook 定义集合
 */
export type HookSchema = Record<string, HookDefinition>

/**
 * 未声明强类型 Schema 时使用的宽松 Hook 集合
 */
export type LooseHookSchema = Record<
  string,
  HookDefinition<HookKind, void, unknown>
>

/**
 * 定义并冻结 Hook Schema
 *
 * @typeParam Schema - Hook 定义集合的精确类型
 * @param schema - 待定义的 Hook 集合
 * @returns 冻结后的 Hook Schema
 */
export function defineHooks<const Schema extends HookSchema>(
  schema: Schema,
): Readonly<Schema> {
  Object.values(schema).forEach(definition => Object.freeze(definition))
  return Object.freeze({ ...schema })
}

/**
 * 定义一个累加结果的 Add Hook
 *
 * @typeParam Args - 传递给 Hook 处理函数的参数类型
 * @typeParam Value - 累加结果数组类型
 * @returns Add Hook 定义
 */
export function defineAddHook<
  Args = void,
  Value extends unknown[] = unknown[],
>(): HookDefinition<HookKind.Add, Args, Value> {
  return { kind: HookKind.Add }
}

/**
 * 定义一个按顺序修改值的 Modify Hook
 *
 * @typeParam Value - 被修改的值类型
 * @typeParam Args - 传递给 Hook 处理函数的参数类型
 * @returns Modify Hook 定义
 */
export function defineModifyHook<Value, Args = void>(): HookDefinition<
  HookKind.Modify,
  Args,
  Value
> {
  return { kind: HookKind.Modify }
}

/**
 * 定义一个获取首个非空结果的 Get Hook
 *
 * @typeParam Args - 传递给 Hook 处理函数的参数类型
 * @typeParam Value - Hook 返回值类型
 * @returns Get Hook 定义
 */
export function defineGetHook<Args, Value>(): HookDefinition<
  HookKind.Get,
  Args,
  Value
> {
  return { kind: HookKind.Get }
}

/**
 * 定义一个无参数的 Event Hook
 *
 * @returns 无参数 Event Hook 定义
 */
export function defineEventHook(): HookDefinition<HookKind.Event, void, void>
/**
 * 定义一个带参数的 Event Hook
 *
 * @typeParam Args - 传递给 Hook 处理函数的参数类型
 * @returns 带参数 Event Hook 定义
 */
export function defineEventHook<Args>(): HookDefinition<
  HookKind.Event,
  Args,
  void
>
/**
 * 创建 Event Hook 的运行时定义
 *
 * @returns Event Hook 定义
 *
 * @internal
 */
export function defineEventHook(): HookDefinition<
  HookKind.Event,
  unknown,
  void
> {
  return { kind: HookKind.Event }
}

/**
 * 从 Hook 定义中提取参数类型
 *
 * @typeParam Definition - 待提取参数的 Hook 定义
 */
export type HookArgs<Definition extends HookDefinition> = NonNullable<
  Definition['__types__']
>['args']

/**
 * 从 Hook 定义中提取值类型
 *
 * @typeParam Definition - 待提取值的 Hook 定义
 */
export type HookValue<Definition extends HookDefinition> = NonNullable<
  Definition['__types__']
>['value']

/**
 * 根据 Hook 参数是否为空决定 `args` 字段是否必填
 *
 * @typeParam Args - Hook 参数类型
 */
type HookArgsOption<Args> = [Args] extends [void]
  ? { args?: Args }
  : { args: Args }

/**
 * 根据 Hook 定义推导 `runHook()` 的选项类型
 *
 * @typeParam Definition - Hook 定义
 */
export type HookRunOptions<Definition extends HookDefinition> =
  HookKind extends Definition['kind']
    ? LooseHookRunOptions<HookValue<Definition>, HookArgs<Definition>>
    : Definition['kind'] extends HookKind.Add
      ? HookArgsOption<HookArgs<Definition>> & {
          initialValue?: HookValue<Definition>
        }
      : Definition['kind'] extends HookKind.Modify
        ? HookArgsOption<HookArgs<Definition>> & {
            initialValue: HookValue<Definition>
          }
        : HookArgsOption<HookArgs<Definition>>

/**
 * 根据 Hook 定义推导 `runHook()` 的参数列表
 *
 * @typeParam Definition - Hook 定义
 */
export type HookRunArguments<Definition extends HookDefinition> =
  Definition['kind'] extends HookKind.Modify
    ? [options: HookRunOptions<Definition>]
    : [HookArgs<Definition>] extends [void]
      ? [options?: HookRunOptions<Definition>]
      : [options: HookRunOptions<Definition>]

/**
 * 根据 Hook 定义推导 `runHook()` 的结果类型
 *
 * @typeParam Definition - Hook 定义
 */
export type HookRunResult<Definition extends HookDefinition> =
  Definition['kind'] extends HookKind.Get
    ? HookValue<Definition> | undefined
    : HookValue<Definition>

/**
 * 根据 Hook 定义推导插件侧的注册函数
 *
 * @typeParam Definition - Hook 定义
 */
export type HookRegistration<Definition extends HookDefinition> =
  Definition['kind'] extends HookKind.Add
    ? (
        fn: (
          args: HookArgs<Definition>,
        ) => MaybePromise<
          | HookValue<Definition>
          | (HookValue<Definition> extends readonly unknown[]
              ? HookValue<Definition>[number]
              : never)
          | null
          | undefined
        >,
        options?: HookRegistrationOptions,
      ) => void
    : Definition['kind'] extends HookKind.Modify
      ? (
          fn: (
            initialValue: HookValue<Definition>,
            args: HookArgs<Definition>,
          ) => MaybePromise<HookValue<Definition>>,
          options?: HookRegistrationOptions,
        ) => void
      : Definition['kind'] extends HookKind.Get
        ? (
            fn: (
              args: HookArgs<Definition>,
            ) => MaybePromise<HookValue<Definition> | null | undefined>,
            options?: HookRegistrationOptions,
          ) => void
        : (
            fn: (args: HookArgs<Definition>) => MaybePromise<void | undefined>,
            options?: HookRegistrationOptions,
          ) => void

/**
 * 由 Hook Schema 推导插件侧注册 API
 *
 * @typeParam Schema - Hook Schema
 */
export type HookRegistrationApi<Schema extends HookSchema> = {
  [Key in keyof Schema]: HookRegistration<Schema[Key]>
}
