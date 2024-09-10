import * as utils from '@eljs/utils'
import _ from 'lodash'
import { ConfigManager } from '../config/manager'
import { EnableBy } from '../enum'
import {
  ApplyPluginsType,
  Env,
  PluginType,
  type AppData,
  type ApplyEvent,
  type ApplyModify,
  type Args,
  type Generator,
  type Paths,
  type PluginConfig,
  type ProxyPluginAPIPropsExtractorReturnType,
  type UserConfig,
} from '../types'
import { Command } from './command'
import { Hook } from './hook'
import { Plugin } from './plugin'
export interface ServiceOpts {
  /**
   * 当前执行路径
   */
  cwd: string
  /**
   * 当前环境
   */
  env: Env
  /**
   * 框架名称
   */
  frameworkName?: string
  /**
   * bin 名称
   */
  binName?: string
  /**
   * 默认的配置文件列表
   */
  defaultConfigFiles?: string[]
  /**
   * 预设集合
   */
  presets?: string[]
  /**
   * 插件集合
   */
  plugins?: string[]
}
export interface ServiceRunOpts {
  /**
   * 当前执行的命令名称
   */
  name?: string
  /**
   * 目标执行路径
   */
  target?: string
  /**
   * 命令执行参数
   */
  args?: any
}
export declare class Service {
  /**
   * 构造函数配置项
   */
  opts: ServiceOpts
  /**
   * 当前执行路径
   */
  cwd: string
  /**
   * 目标执行路径
   */
  target: string
  /**
   * 当前环境
   */
  env: Env
  /**
   * 执行 `run` 函数时传入的名字（具体的命令）
   */
  name: string
  /**
   * bin 名称
   */
  binName: string
  /**
   * 其它执行参数
   */
  args: Args
  /**
   * 用户项目配置
   */
  userConfig: UserConfig
  /**
   * 配置管理器
   */
  configManager: ConfigManager
  /**
   * 执行阶段
   */
  stage: string
  /**
   * 插件配置项，是否启用可通过 `modifyConfig` 方法修改
   */
  pluginConfig: PluginConfig
  /**
   * 存储全局数据
   */
  appData: AppData
  /**
   * 存储项目路径
   */
  paths: Paths
  /**
   * 钩子映射表
   */
  hooks: Record<string, Hook[]>
  /**
   * 命令集合
   */
  commands: Record<string, Command>
  /**
   * 微生成器集合
   */
  generators: Record<string, Generator>
  /**
   * 插件集合
   */
  plugins: Record<string, Plugin>
  /**
   * 插件映射表
   */
  keyToPluginMap: Record<string, Plugin>
  /**
   * 插件方法集合
   */
  pluginMethods: Record<
    string,
    {
      plugin: Plugin
      fn: (...args: any[]) => void
    }
  >
  /**
   * 跳过插件的 ID 集合
   */
  skipPluginIds: Set<string>
  /**
   * Npm 包前缀
   */
  private _prefix
  constructor(opts: ServiceOpts)
  initPlugin(opts: {
    plugin: Plugin
    plugins: Plugin[]
    presets?: Plugin[]
  }): Promise<{
    plugins: Plugin[]
    presets: Plugin[]
  }>
  initPreset(opts: {
    preset: Plugin
    presets: Plugin[]
    plugins: Plugin[]
  }): Promise<void>
  applyPlugins<T>(opts: {
    key: string
    type?: ApplyPluginsType
    initialValue?: any
    args?: any
  }): Promise<typeof opts.initialValue | T>
  run(opts: ServiceRunOpts): Promise<void>
  isPluginEnable(hook: Hook | string): boolean
  commandGuessHelper(commands: string[], currentCmd: string): void
  /**
   * 执行 `run` 方法之前调用的钩子
   */
  protected beforeRun(opts: ServiceRunOpts, service: Service): Promise<void>
  /**
   * 执行 `applyPlugin('modifyConfig')` 之前调用的钩子
   */
  protected beforeModifyPluginConfig<T extends PluginConfig>(
    opts: ServiceRunOpts,
    config: T,
    service: Service,
  ): Promise<T | void>
  /**
   * 执行 `applyPlugin('modifyPaths')` 之前调用的钩子
   */
  protected beforeModifyPaths<T extends Paths>(
    opts: ServiceRunOpts,
    paths: T,
    service: Service,
  ): Promise<T | void>
  /**
   * 执行 `applyPlugin('modifyAppData')' 之前调用的钩子
   */
  protected beforeModifyAppData<T extends AppData>(
    opts: ServiceRunOpts,
    appData: T,
    service: Service,
  ): Promise<T | void>
  /**
   * 执行命令之前的钩子
   */
  protected beforeRunCommand(
    opts: ServiceRunOpts,
    service: Service,
  ): Promise<void>
  /**
   * 执行 `run` 方法之后的钩子
   */
  protected afterRun(opts: ServiceRunOpts, service: Service): Promise<void>
  /**
   * 自定义的预设提取器
   */
  protected presetsExtractor(
    presets: string[],
    cwd: string,
    opts: Record<string, any>,
  ): string[]
  /**
   * 自定义的插件提取器
   */
  protected pluginsExtractor(
    plugins: string[],
    cwd: string,
    opts: Record<string, any>,
  ): string[]
  /**
   * 自定义的代理插件API属性提取器
   */
  protected proxyPluginAPIPropsExtractor(): ProxyPluginAPIPropsExtractorReturnType
  /**
   * 插件是否可以启用，需要优先满足 `Service#isPluginEnable` 的逻辑
   */
  protected isPluginEnableBy(plugin: Plugin): boolean
  private _baconPlugins
}
export interface ServicePluginAPI {
  /**
   * 当前执行路径
   */
  cwd: typeof Service.prototype.cwd
  /**
   * 命令名称
   */
  name: typeof Service.prototype.name
  /**
   * bin 名称
   */
  binName: typeof Service.prototype.name
  /**
   * 目标路径
   */
  target: typeof Service.prototype.target
  /**
   * 命令执行传入的其他参数
   */
  args: typeof Service.prototype.args
  /**
   * 用户配置
   */
  userConfig: typeof Service.prototype.userConfig
  /**
   * 插件配置项，是否启用可通过 `modifyPluginConfig` 方法修改
   */
  pluginConfig: typeof Service.prototype.pluginConfig
  /**
   * 存储项目相关全局数据
   */
  appData: typeof Service.prototype.appData
  /**
   * 存储项目相关路径
   */
  paths: Required<typeof Service.prototype.paths>
  /**
   * 全局命令集合
   */
  commands: typeof Service.prototype.commands
  /**
   * 全局微生成器集合
   */
  generators: typeof Service.prototype.generators
  /**
   * 修改用户业务配置，用于控制插件启用或者其它业务逻辑
   */
  modifyPluginConfig: ApplyModify<PluginConfig, null>
  /**
   * 修改项目路径
   */
  modifyPaths: ApplyModify<typeof Service.prototype.paths, null>
  /**
   * 修改应用数据
   */
  modifyAppData: ApplyModify<typeof Service.prototype.appData, null>
  /**
   * 应用检查事件
   */
  onCheck: ApplyEvent<null>
  /**
   * 应用启动事件
   */
  onStart: ApplyEvent<null>
  /**
   * 执行插件
   */
  applyPlugins: typeof Service.prototype.applyPlugins
  /**
   * 插件是否可用
   */
  isPluginEnable: typeof Service.prototype.isPluginEnable
  /**
   * 注册预设
   */
  registerPresets: (presets: string[]) => void
  /**
   * 注册插件预设
   */
  registerPlugins: (plugins: (Plugin | Record<string, unknown>)[]) => void
  /**
   * 工具函数
   */
  utils: typeof utils
  /**
   * lodash
   */
  lodash: typeof _
  /**
   * 插件执行类型枚举
   */
  ApplyPluginsType: typeof ApplyPluginsType
  /**
   * 是否开启插件类型枚举
   */
  EnableBy: typeof EnableBy
  /**
   * 插件类型枚举
   */
  PluginType: typeof PluginType
}
//# sourceMappingURL=service.d.ts.map
