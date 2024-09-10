import type { Args } from '../types'
import { Plugin } from './plugin'
import type { ResolveConfigMode } from './plugin-api'
export interface CommandOpts {
  /**
   * 命令名称
   */
  name: Command['name']
  /**
   * 插件
   */
  plugin: Command['plugin']
  /**
   * 命令描述
   */
  description?: Command['description']
  /**
   * 命令行参数
   */
  options?: Command['options']
  /**
   * 命令行详细描述
   */
  details?: Command['details']
  /**
   * 配置解析模式
   */
  configResolveMode?: Command['configResolveMode']
  /**
   * 命令执行函数
   */
  fn: Command['fn']
}
export declare class Command {
  /**
   * 命令名称
   */
  name: string
  /**
   * 插件
   */
  plugin: Plugin
  /**
   * 命令描述
   */
  description?: string
  /**
   * 命令行参数
   */
  options?: string
  /**
   * 命令行详细描述
   */
  details?: string
  /**
   * 配置解析模式
   */
  configResolveMode: ResolveConfigMode
  /**
   * 命令执行函数
   */
  fn: {
    ({ args }: { args: Args }): void
  }
  constructor(opts: CommandOpts)
}
//# sourceMappingURL=command.d.ts.map
