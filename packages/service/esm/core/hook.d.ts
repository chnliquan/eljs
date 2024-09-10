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
export declare class Hook {
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
   * Hook 执行阶段，数字越小执行越早
   */
  stage?: number
  /**
   * Hook 执行函数
   */
  fn: (...args: any[]) => any
  constructor(opts: HookOpts)
}
//# sourceMappingURL=hook.d.ts.map
