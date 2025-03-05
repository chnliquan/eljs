import assert from 'assert'
import { Plugin } from './plugin'

export interface HookOpts {
  /**
   * Hook 对应的插件实例
   */
  plugin: Hook['plugin']
  /**
   * Hook 的唯一标识
   */
  key: Hook['key']
  /**
   * 指定在某个 Hook 之前执行
   */
  before?: Hook['before']
  /**
   * Hook 执行阶段，数字越小执行越早
   */
  stage?: Hook['stage']
  /**
   * Hook 执行函数
   */
  fn: Hook['fn']
}

export class Hook {
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
   * Hook 执行阶段，数字越小执行越早
   */
  public stage?: number
  /**
   * Hook 执行函数
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public fn: (...args: any[]) => any

  public constructor(opts: HookOpts) {
    assert(
      opts.key && opts.fn,
      `Invalid hook ${opts}, key and fn must supplied.`,
    )
    this.plugin = opts.plugin
    this.key = opts.key
    this.before = opts.before
    this.stage = opts.stage || 0
    this.fn = opts.fn
  }
}
