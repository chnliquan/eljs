import type { MaybePromiseFunction } from '@eljs/utils'
import assert from 'node:assert'

import type { Plugin } from './plugin'

/**
 * 构造函数参数
 */
export interface HookOptions {
  /**
   * Hook 对应的插件实例
   */
  plugin: Plugin
  /**
   * Hook 的唯一标识
   */
  key: string
  /**
   * 指定在某个 Hook 之前执行
   */
  before?: string
  /**
   * Hook 执行阶段，值越小执行越早
   */
  stage?: number
  /**
   * Hook 执行函数
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: MaybePromiseFunction<any>
}

/**
 * 钩子类
 */
export class Hook {
  /**
   * 构造函数参数
   */
  public constructorOptions: HookOptions
  /**
   * Hook 对应的插件实例
   */
  public plugin: Plugin
  /**
   * Hook 的唯一标识
   */
  public key: string
  /**
   * 指定在某个 Hook 之前执行
   */
  public before?: string
  /**
   * Hook 执行阶段，值越小执行越早
   */
  public stage?: number
  /**
   * Hook 执行函数
   */
  public fn: HookOptions['fn']

  public constructor(options: HookOptions) {
    assert(
      options.key && options.fn,
      `Invalid hook ${options}, \`key\` and \`fn\` must be supplied.`,
    )

    const { key, fn, plugin, before, stage } = options
    this.constructorOptions = options
    this.plugin = plugin
    this.key = key
    this.before = before
    this.stage = stage
    this.fn = fn
  }
}
