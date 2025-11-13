import type { MaybePromiseFunction } from '@eljs/utils'
import assert from 'node:assert'

import type { Plugin } from './plugin'

/**
 * 钩子类构造函数选项
 */
export interface HookOptions {
  /**
   * 钩子对应的插件实例
   */
  plugin: Plugin
  /**
   * 钩子的唯一标识
   */
  key: string
  /**
   * 指定在某个钩子之前执行
   */
  before?: string
  /**
   * 钩子执行阶段，值越小执行越早
   */
  stage?: number
  /**
   * 钩子执行函数
   */
  fn: MaybePromiseFunction
}

/**
 * 钩子类
 */
export class Hook {
  /**
   * 构造函数选项
   */
  public constructorOptions: HookOptions
  /**
   * 钩子对应的插件实例
   */
  public plugin: Plugin
  /**
   * 钩子的唯一标识
   */
  public key: string
  /**
   * 指定在某个钩子之前执行
   */
  public before?: string
  /**
   * 钩子执行阶段，值越小执行越早
   */
  public stage?: number
  /**
   * 钩子执行函数
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
