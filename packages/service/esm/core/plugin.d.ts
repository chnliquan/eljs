import { type PkgJSON } from '@eljs/utils'
import { EnableBy } from '../enum'
import type {
  PluginConfig,
  PluginReturnType,
  PluginType,
  PresetsOrPluginsExtractor,
  UserConfig,
} from '../types'
export interface PluginOpts {
  path: Plugin['path']
  type: Plugin['type']
  cwd: Plugin['_cwd']
  prefix?: Plugin['_prefix']
}
export declare class Plugin {
  /**
   * 插件类型
   */
  type: PluginType
  /**
   * 预设/插件入口
   */
  path: string
  /**
   * 插件 ID
   */
  id: string
  /**
   * 插件 key
   */
  key: string
  /**
   * 插件配置项
   */
  config: PluginConfig
  /**
   * 插件执行时间
   */
  time: {
    register?: number
    hooks: Record<string, number[]>
  }
  /**
   * 插件执行函数
   */
  apply: () => (
    ...args: unknown[]
  ) => PluginReturnType | Promise<PluginReturnType>
  /**
   * 插件是否可以执行
   */
  enableBy: EnableBy | (() => boolean)
  /**
   * 当前路径
   */
  private _cwd
  /**
   * 当前路径
   */
  private _prefix
  /**
   * 插件唯一 key 正则映射表
   */
  private _key2RegexMap
  constructor(opts: PluginOpts)
  get key2RegexMap(): {
    preset: RegExp
    plugin: RegExp
  }
  merge(opts: { key?: string; enableBy?: unknown }): void
  getId(opts: {
    pkgJSON: PkgJSON
    isPkgEntry: boolean
    pkgJSONPath: string | null
  }): string
  getKey(opts: { pkgJSON: PkgJSON; isPkgEntry: boolean }): string
  static stripNoneScope(name: string): string
  static getPresetsAndPlugins(opts: {
    cwd: string
    userConfig: UserConfig
    plugins?: string[]
    presets?: string[]
    presetsExtractor?: PresetsOrPluginsExtractor
    pluginsExtractor?: PresetsOrPluginsExtractor
  }): {
    presets: Plugin[]
    plugins: Plugin[]
  }
}
//# sourceMappingURL=plugin.d.ts.map
