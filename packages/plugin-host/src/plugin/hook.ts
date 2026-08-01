import type { MaybePromiseFunction } from '@eljs/utils'

import { PluginHostError, PluginHostErrorCode } from '../errors'
import type { Plugin } from './plugin'

/**
 * 创建 Hook 注册记录所需的选项
 */
export interface HookOptions {
  /**
   * 钩子对应的插件实例
   */
  readonly plugin: Plugin
  /**
   * 钩子的唯一标识
   */
  readonly key: string
  /**
   * 指定在某个钩子之前执行
   */
  readonly before?: string
  /**
   * 钩子执行阶段，值越小执行越早
   */
  readonly stage?: number
  /**
   * 钩子执行函数
   */
  readonly fn: MaybePromiseFunction
}

/**
 * 一个插件注册的 Hook 记录
 */
export class Hook {
  /**
   * 构造函数选项
   */
  public readonly constructorOptions: Readonly<HookOptions>
  /**
   * 钩子对应的插件实例
   */
  public readonly plugin: Plugin
  /**
   * 钩子的唯一标识
   */
  public readonly key: string
  /**
   * 指定在某个钩子之前执行
   */
  public readonly before?: string
  /**
   * 钩子执行阶段，值越小执行越早
   */
  public readonly stage?: number
  /**
   * 钩子执行函数
   */
  public readonly fn: HookOptions['fn']

  /**
   * 创建 Hook 记录
   *
   * @param options - Hook 标识、处理函数、所属插件及排序配置
   * @throws {@link PluginHostError}
   * 当 Hook 标识或处理函数缺失时抛出
   */
  public constructor(options: HookOptions) {
    if (
      !options ||
      typeof options !== 'object' ||
      !options.plugin ||
      typeof options.key !== 'string' ||
      !options.key.trim() ||
      options.key !== options.key.trim() ||
      typeof options.fn !== 'function' ||
      (options.before !== undefined &&
        (typeof options.before !== 'string' ||
          !options.before.trim() ||
          options.before !== options.before.trim())) ||
      (options.stage !== undefined &&
        (typeof options.stage !== 'number' || Number.isNaN(options.stage)))
    ) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidHook,
        `Invalid Hook registration options.`,
        {
          details: {
            before: options?.before,
            hookKey: options?.key,
            pluginId: options?.plugin?.id,
            stage: options?.stage,
          },
        },
      )
    }

    const { key, fn, plugin, before, stage } = options
    this.constructorOptions = Object.freeze({ ...options })
    this.plugin = plugin
    this.key = key
    this.before = before
    this.stage = stage
    this.fn = fn
  }
}
