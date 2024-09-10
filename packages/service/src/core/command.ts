import type { Args } from '@/types'
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

export class Command {
  /**
   * 命令名称
   */
  public name: string
  /**
   * 插件
   */
  public plugin: Plugin
  /**
   * 命令描述
   */
  public description?: string
  /**
   * 命令行参数
   */
  public options?: string
  /**
   * 命令行详细描述
   */
  public details?: string
  /**
   * 配置解析模式
   */
  public configResolveMode: ResolveConfigMode
  /**
   * 命令执行函数
   */
  public fn: {
    ({ args }: { args: Args }): void
  }

  public constructor(opts: CommandOpts) {
    this.name = opts.name
    this.plugin = opts.plugin
    this.description = opts.description
    this.options = opts.options
    this.details = opts.details
    this.configResolveMode = opts.configResolveMode || 'strict'
    this.fn = opts.fn
  }
}
