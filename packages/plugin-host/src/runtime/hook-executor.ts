import {
  AsyncSeriesBailHook,
  AsyncSeriesHook,
  AsyncSeriesWaterfallHook,
} from 'tapable'

import { HookKind, type LooseHookRunOptions } from '../core/types'
import { PluginHostError, PluginHostErrorCode } from '../errors'
import type { Hook } from '../plugin/hook'
import type { HookSchema } from '../plugin/hook-schema'
import { HookRegistry } from './hook-registry'
import { PluginRegistry } from './plugin-registry'

/**
 * 根据 Hook 类型执行聚合逻辑
 *
 * @internal
 */
export class HookExecutor {
  /**
   * 创建 Hook 执行器
   *
   * @param _hooks - Hook 注册表
   * @param _plugins - 插件注册表
   * @param _schema - Hook 运行时契约
   * @param _signal - 用于在 Hook 边界停止执行的取消信号
   */
  public constructor(
    private readonly _hooks: HookRegistry,
    private readonly _plugins: PluginRegistry,
    private readonly _schema: HookSchema,
    private readonly _signal?: AbortSignal,
  ) {}

  /**
   * 执行指定 Hook
   *
   * @param key - Hook key
   * @param options - 初始值、Hook 参数及 schema-less 类型信息
   * @returns Hook 聚合结果
   * @throws {@link PluginHostError}
   * 当 Hook 类型或调用选项无效时抛出
   */
  public async run(
    key: string,
    options: LooseHookRunOptions<unknown, unknown> = {},
  ): Promise<unknown> {
    this._throwIfAborted(key)

    if (typeof key !== 'string' || !key.trim()) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidHook,
        `Run hook failed, Hook key must be a non-empty string.`,
        { details: { hookKey: key } },
      )
    }

    let { kind } = options
    const schemaKind = this._schema[key]?.kind

    if (kind && schemaKind && kind !== schemaKind) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidHook,
        `Run hook \`${key}\` failed, expected kind \`${schemaKind}\`, but got \`${kind}\`.`,
        {
          details: { actualKind: kind, expectedKind: schemaKind, hookKey: key },
        },
      )
    }

    kind ||= schemaKind || this._inferKind(key)

    const hooks = this._hooks.get(key)
    const { initialValue, args } = options

    switch (kind) {
      case HookKind.Add:
        return this._runAdd(hooks, key, initialValue, args, options)
      case HookKind.Modify:
        return this._runModify(hooks, key, initialValue, args, options)
      case HookKind.Get:
        return this._runGet(hooks, key, args)
      case HookKind.Event:
        return this._runEvent(hooks, key, args)
      default:
        throw new PluginHostError(
          PluginHostErrorCode.InvalidHook,
          `Run hook \`${key}\` failed, kind is missing or invalid: \`${kind}\`.`,
          { details: { hookKey: key, hookKind: kind } },
        )
    }
  }

  /**
   * 在 schema-less 模式中根据 Hook 命名约定推断执行类型
   *
   * @param key - Hook key
   * @returns 推断出的 Hook 类型
   * @throws {@link PluginHostError}
   * 当 Hook 名称不符合任何约定时抛出
   */
  private _inferKind(key: string): HookKind {
    if (key.startsWith('on')) {
      return HookKind.Event
    }
    if (key.startsWith('get')) {
      return HookKind.Get
    }
    if (key.startsWith('modify')) {
      return HookKind.Modify
    }
    if (key.startsWith('add')) {
      return HookKind.Add
    }

    throw new PluginHostError(
      PluginHostErrorCode.InvalidHook,
      `Invalid runHook() arguments, \`kind\` must be supplied for key \`${key}\`.`,
      { details: { hookKey: key } },
    )
  }

  /**
   * 执行 Add Hook 并累加返回值
   *
   * @param hooks - Hook 记录
   * @param key - Hook key
   * @param initialValue - 初始数组
   * @param args - Hook 参数
   * @param options - 原始执行选项
   * @returns 累加后的数组
   */
  private async _runAdd(
    hooks: readonly Hook[],
    key: string,
    initialValue: unknown,
    args: unknown,
    options: LooseHookRunOptions<unknown, unknown>,
  ): Promise<unknown> {
    if ('initialValue' in options && !Array.isArray(initialValue)) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidOptions,
        `Run hook \`${key}\` failed, \`options.initialValue\` must be an array for an add Hook.`,
        { details: { hookKey: key, initialValue } },
      )
    }

    const tapable = new AsyncSeriesWaterfallHook(['memo'])
    for (const hook of hooks) {
      if (!this._plugins.isHookEnabled(hook.plugin)) {
        continue
      }
      tapable.tapPromise(this._tapOptions(hook), async memo => {
        const result = await this._runHook(hook, key, () => hook.fn(args))
        return result == null ? memo : (memo as []).concat(result)
      })
    }
    return tapable.promise(initialValue || [])
  }

  /**
   * 执行 Modify Hook 瀑布流
   *
   * @param hooks - Hook 记录
   * @param key - Hook key
   * @param initialValue - 初始值
   * @param args - Hook 参数
   * @returns 最终修改结果
   */
  private async _runModify(
    hooks: readonly Hook[],
    key: string,
    initialValue: unknown,
    args: unknown,
    options: LooseHookRunOptions<unknown, unknown>,
  ): Promise<unknown> {
    if (!Object.hasOwn(options, 'initialValue')) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidOptions,
        `Run hook \`${key}\` failed, \`options.initialValue\` is required for a modify Hook.`,
        { details: { hookKey: key } },
      )
    }

    const tapable = new AsyncSeriesWaterfallHook(['memo'])
    for (const hook of hooks) {
      if (!this._plugins.isHookEnabled(hook.plugin)) {
        continue
      }
      tapable.tapPromise(this._tapOptions(hook), memo =>
        this._runHook(hook, key, () => hook.fn(memo, args)),
      )
    }
    return tapable.promise(initialValue)
  }

  /**
   * 执行 Get Hook，直到获得首个非空结果
   *
   * @param hooks - Hook 记录
   * @param key - Hook key
   * @param args - Hook 参数
   * @returns 首个非空结果，未命中时返回 `undefined`
   */
  private async _runGet(
    hooks: readonly Hook[],
    key: string,
    args: unknown,
  ): Promise<unknown> {
    const tapable = new AsyncSeriesBailHook(['_'])
    for (const hook of hooks) {
      if (!this._plugins.isHookEnabled(hook.plugin)) {
        continue
      }
      tapable.tapPromise(this._tapOptions(hook), async () => {
        const result = await this._runHook(hook, key, () => hook.fn(args))
        return result == null ? undefined : result
      })
    }
    return tapable.promise(0)
  }

  /**
   * 顺序执行全部 Event Hook
   *
   * @param hooks - Hook 记录
   * @param key - Hook key
   * @param args - Hook 参数
   * @returns 所有 Hook 完成后兑现的 Promise
   */
  private async _runEvent(
    hooks: readonly Hook[],
    key: string,
    args: unknown,
  ): Promise<void> {
    const tapable = new AsyncSeriesHook(['_'])
    for (const hook of hooks) {
      if (!this._plugins.isHookEnabled(hook.plugin)) {
        continue
      }
      tapable.tapPromise(this._tapOptions(hook), async () => {
        await this._runHook(hook, key, () => hook.fn(args))
      })
    }
    await tapable.promise(0)
  }

  /**
   * 转换为 Tapable 使用的排序选项
   *
   * @param hook - Hook 记录
   * @returns Tapable 注册选项
   */
  private _tapOptions(hook: Hook) {
    return {
      name: hook.plugin.key,
      stage: hook.stage,
      before: hook.before,
    }
  }

  /**
   * 执行单个 Hook 并统一转换执行错误
   *
   * @typeParam T - Hook 返回值类型
   * @param hook - Hook 记录
   * @param key - Hook key
   * @param fn - 实际执行函数
   * @returns Hook 返回值
   */
  private async _runHook<T>(
    hook: Hook,
    key: string,
    fn: () => T | Promise<T>,
  ): Promise<T> {
    this._throwIfAborted(key)

    try {
      const result = await fn()
      this._throwIfAborted(key)
      return result
    } catch (error) {
      if (
        error instanceof PluginHostError &&
        error.code === PluginHostErrorCode.OperationAborted
      ) {
        throw error
      }

      throw new PluginHostError(
        PluginHostErrorCode.HookExecutionFailed,
        `Run hook \`${key}\` from plugin \`${hook.plugin.key}\` failed: ${
          (error as Error).message
        }`,
        {
          cause: error,
          details: {
            hookKey: key,
            pluginId: hook.plugin.id,
            pluginKey: hook.plugin.key,
            pluginPath: hook.plugin.path,
          },
        },
      )
    }
  }

  /**
   * 在 Hook 边界将取消信号转换为稳定领域错误
   *
   * @param hookKey - 当前 Hook key
   * @throws {@link PluginHostError} 调用方已经取消时抛出
   */
  private _throwIfAborted(hookKey: string): void {
    if (this._signal?.aborted) {
      throw new PluginHostError(
        PluginHostErrorCode.OperationAborted,
        `Run hook \`${hookKey}\` was aborted.`,
        {
          cause: this._signal.reason,
          details: { hookKey },
        },
      )
    }
  }
}
