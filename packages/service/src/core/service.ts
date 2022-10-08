import utils, { chalk, deepMerge } from '@eljs/utils'
import assert from 'assert'
import { existsSync } from 'fs'
import { AsyncSeriesWaterfallHook } from 'tapable'
import { ConfigManager } from '../config/manager'
import {
  AppData,
  ApplyEvent,
  ApplyModify,
  ApplyPluginsType,
  Args,
  EnableBy,
  Env,
  Paths,
  PluginConfig,
  PluginType,
  ProxyPluginAPIPropsExtractorReturnType,
  ServiceStage,
  UserConfig,
} from '../types'
import { Hook } from './hook'
import { Plugin } from './plugin'
import { PluginAPI } from './plugin-api'

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
   * 默认的配置文件列表
   */
  defaultConfigFiles?: []
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
  target: string
  args?: any
}

export class Service {
  /**
   * 构造函数配置项
   */
  public opts: ServiceOpts
  /**
   * 当前执行路径
   */
  public cwd: string
  /**
   * 当前环境
   */
  public env: Env
  /**
   * 其它执行参数
   */
  public args: Args = {
    _: [],
  }
  /**
   * 用户项目配置
   */
  public userConfig: UserConfig = {
    presets: [],
    plugins: [],
  }
  /**
   * 配置管理器
   */
  public configManager: ConfigManager | null = null
  /**
   * 执行阶段
   */
  public stage: string = ServiceStage.Uninitialized
  /**
   * 存储全局数据
   */
  public appData: AppData = {}
  /**
   * 存储项目路径
   */
  public paths: Paths = {
    cwd: '',
  }
  /**
   * 插件配置项，是否启用可通过 `modifyConfig` 方法修改
   */
  public pluginConfig: PluginConfig = {}
  /**
   * 钩子映射表
   */
  public hooks: Record<string, Hook[]> = {}
  /**
   * 插件集合
   */
  public plugins: Record<string, Plugin> = {}
  /**
   * 插件映射表
   */
  public keyToPluginMap: Record<string, Plugin> = {}
  /**
   * 插件方法集合
   */
  public pluginMethods: Record<
    string,
    { plugin: Plugin; fn: (...args: any[]) => void }
  > = {}
  /**
   * 跳过插件的 ID 集合
   */
  public skipPluginIds: Set<string> = new Set<string>()
  /**
   * Npm 包前缀
   */
  private _prefix: string

  public constructor(opts: ServiceOpts) {
    this.opts = opts
    this.cwd = opts.cwd
    this.env = opts.env
    this._prefix = opts.frameworkName
      ? opts.frameworkName.endsWith('-')
        ? opts.frameworkName
        : `${opts.frameworkName}-`
      : '@eljs/service-'

    assert(existsSync(this.cwd), `Invalid cwd ${this.cwd}, it's not found.`)
  }

  public async initPlugin(opts: {
    plugin: Plugin
    plugins: Plugin[]
    presets?: Plugin[]
  }) {
    // register to this.plugins
    assert(
      !this.plugins[opts.plugin.id],
      `${opts.plugin.type} ${opts.plugin.id} is already registered by ${
        this.plugins[opts.plugin.id]?.path
      }, ${opts.plugin.type} from ${opts.plugin.path} register failed.`,
    )

    this.plugins[opts.plugin.id] = opts.plugin

    // apply with PluginAPI
    const pluginAPI = new PluginAPI({
      plugin: opts.plugin,
      service: this,
    })

    pluginAPI.registerPresets = pluginAPI.registerPresets.bind(
      pluginAPI,
      opts.presets || [],
      this._prefix,
    )
    pluginAPI.registerPlugins = pluginAPI.registerPlugins.bind(
      pluginAPI,
      opts.plugins,
      this._prefix,
    )

    // merge proxy props
    const proxyPluginAPIProps = deepMerge(
      {
        serviceProps: [
          'cwd',
          'appData',
          'paths',
          'config',
          'applyPlugins',
          'isPluginEnable',
        ],
        staticProps: {
          ApplyPluginsType,
          EnableBy,
          PluginType,
          service: this,
          utils,
        },
      },
      this.proxyPluginAPIPropsExtractor(),
    )

    const proxyPluginAPI = PluginAPI.proxyPluginAPI({
      service: this,
      pluginAPI,
      ...proxyPluginAPIProps,
    })

    const ret: {
      plugins: Plugin[]
      presets: Plugin[]
    } = Object.create(null)

    const dateStart = new Date()
    const pluginRet = await opts.plugin.apply()(proxyPluginAPI)
    opts.plugin.time.register = new Date().getTime() - dateStart.getTime()

    if (opts.plugin.type === 'plugin') {
      assert(!pluginRet, `plugin should return nothing.`)
    }

    // key should be unique
    assert(
      !this.keyToPluginMap[opts.plugin.key],
      `key ${opts.plugin.key} is already registered by ${
        this.keyToPluginMap[opts.plugin.key]?.path
      }, ${opts.plugin.type} from ${opts.plugin.path} register failed.`,
    )

    this.keyToPluginMap[opts.plugin.key] = opts.plugin

    if (pluginRet?.presets) {
      ret.presets = pluginRet.presets.map(
        (preset: string) =>
          new Plugin({
            path: preset,
            type: PluginType.Preset,
            cwd: this.cwd,
            prefix: this._prefix,
          }),
      )
    }

    if (pluginRet?.plugins) {
      ret.plugins = pluginRet.plugins.map(
        plugin =>
          new Plugin({
            path: plugin,
            type: PluginType.Plugin,
            cwd: this.cwd,
            prefix: this._prefix,
          }),
      )
    }

    // merge plugin config
    this.pluginConfig = {
      ...this.pluginConfig,
      ...opts.plugin.config,
    }

    return ret
  }

  public async initPreset(opts: {
    preset: Plugin
    presets: Plugin[]
    plugins: Plugin[]
  }) {
    const { presets, plugins } = await this.initPlugin({
      plugin: opts.preset,
      presets: opts.presets,
      plugins: opts.plugins,
    })
    opts.presets.unshift(...(presets || []))
    opts.plugins.push(...(plugins || []))
  }

  public async applyPlugins<T>(opts: {
    key: string
    type?: ApplyPluginsType
    initialValue?: any
    args?: any
  }): Promise<typeof opts.initialValue | T> {
    let { type } = opts

    // guess type from key
    if (!type) {
      if (opts.key.startsWith('on')) {
        type = ApplyPluginsType.Event
      } else if (opts.key.startsWith('modify')) {
        type = ApplyPluginsType.Modify
      } else if (opts.key.startsWith('add')) {
        type = ApplyPluginsType.Add
      } else {
        throw new Error(
          `Invalid applyPlugins arguments, type must be supplied for key ${opts.key}.`,
        )
      }
    }

    const hooks = this.hooks[opts.key] || []

    switch (type) {
      case ApplyPluginsType.Add:
        assert(
          !('initialValue' in opts) || Array.isArray(opts.initialValue),
          `applyPlugins failed, opts.initialValue must be Array if opts.type is add.`,
        )

        // eslint-disable-next-line no-case-declarations
        const tAdd = new AsyncSeriesWaterfallHook(['memo'])

        for (const hook of hooks) {
          if (!this.isPluginEnable(hook)) {
            continue
          }

          tAdd.tapPromise(
            {
              name: hook.plugin.key,
              stage: hook.stage,
              before: hook.before,
            },
            async memo => {
              const dateStart = new Date()
              const items = await hook.fn(opts.args)
              hook.plugin.time.hooks[opts.key] ||= []
              hook.plugin.time.hooks[opts.key].push(
                new Date().getTime() - dateStart.getTime(),
              )
              return (memo as []).concat(items)
            },
          )
        }
        return tAdd.promise(opts.initialValue || [])

      case ApplyPluginsType.Modify:
        // eslint-disable-next-line no-case-declarations
        const tModify = new AsyncSeriesWaterfallHook(['memo'])

        for (const hook of hooks) {
          if (!this.isPluginEnable(hook)) {
            continue
          }
          tModify.tapPromise(
            {
              name: hook.plugin.key,
              stage: hook.stage,
              before: hook.before,
            },
            async memo => {
              const dateStart = new Date()
              const ret = await hook.fn(memo, opts.args)
              hook.plugin.time.hooks[opts.key] ||= []
              hook.plugin.time.hooks[opts.key].push(
                new Date().getTime() - dateStart.getTime(),
              )
              return ret
            },
          )
        }
        return tModify.promise(opts.initialValue)

      case ApplyPluginsType.Event:
        // eslint-disable-next-line no-case-declarations
        const tEvent = new AsyncSeriesWaterfallHook(['_'])

        for (const hook of hooks) {
          if (!this.isPluginEnable(hook)) {
            continue
          }

          tEvent.tapPromise(
            {
              name: hook.plugin.key,
              stage: hook.stage || 0,
              before: hook.before,
            },
            async () => {
              const dateStart = new Date()
              await hook.fn(opts.args)
              hook.plugin.time.hooks[opts.key] ||= []
              hook.plugin.time.hooks[opts.key].push(
                new Date().getTime() - dateStart.getTime(),
              )
            },
          )
        }
        return tEvent.promise(1)

      default:
        throw new Error(
          `applyPlugins failed, type is not defined or is not matched, got ${opts.type}.`,
        )
    }
  }

  public async run(opts: ServiceRunOpts) {
    const { target, args = {} } = opts

    args._ = args._ || []
    // shift the command itself
    if (args._[0] === target) {
      args._.shift()
    }

    this.args = args

    this.beforeRun(opts, this)

    this.stage = ServiceStage.Init

    // get user config
    this.configManager = new ConfigManager({
      cwd: this.cwd,
      env: this.env,
      defaultConfigFiles: this.opts.defaultConfigFiles,
    })
    this.userConfig = this.configManager.getUserConfig().config

    const { plugins, presets } = Plugin.getPresetsAndPlugins({
      cwd: this.cwd,
      userConfig: this.userConfig,
      presets: this.opts.presets || [],
      plugins: (this.opts.plugins || []) as string[],
      extractor: this.presetsAndPluginsExtractor,
    })

    // register presets
    this.stage = ServiceStage.InitPresets

    const presetPlugins: Plugin[] = []
    while (presets.length) {
      await this.initPreset({
        preset: presets.shift() as Plugin,
        presets,
        plugins: presetPlugins,
      })
    }

    plugins.unshift(...presetPlugins)

    // register plugins
    this.stage = ServiceStage.InitPlugins
    while (plugins.length) {
      await this.initPlugin({ plugin: plugins.shift() as Plugin, plugins })
    }

    const pluginConfigInitialValue =
      this.beforeModifyPluginConfig(opts, this.pluginConfig, this) ||
      this.pluginConfig

    // applyPlugin modify config
    this.pluginConfig = await this.applyPlugins({
      key: 'modifyPluginConfig',
      initialValue: pluginConfigInitialValue,
      args: {},
    })

    const defaultPaths = {
      cwd: this.cwd,
      absOutputPath: target,
    }
    const pathsInitialValue =
      this.beforeModifyPaths(opts, defaultPaths, this) || defaultPaths

    // applyPlugin modify paths
    this.paths = await this.applyPlugins({
      key: 'modifyPaths',
      initialValue: pathsInitialValue,
      args: {
        cwd: this.cwd,
      },
    })

    const defaultAppData = {
      cwd: this.cwd,
      args,
      plugins,
      presets,
    }
    const appDataInitialValue =
      this.beforeModifyAppData(opts, defaultAppData, this) || defaultAppData

    // applyPlugin collect app data
    this.stage = ServiceStage.CollectAppData
    this.appData = await this.applyPlugins({
      key: 'modifyAppData',
      initialValue: appDataInitialValue,
    })

    this.afterRun(opts, this)
    this._baconPlugins()
  }

  public isPluginEnable(hook: Hook | string) {
    let plugin: Plugin

    if ((hook as Hook).plugin) {
      plugin = (hook as Hook).plugin
    } else {
      plugin = this.keyToPluginMap[hook as string]
    }

    const { id, enableBy } = plugin

    if (this.skipPluginIds.has(id)) {
      return false
    }

    if (typeof enableBy === 'function') {
      return enableBy()
    }

    return this.isPluginEnableBy(plugin)
  }

  /**
   * 执行 `run` 方法之前的钩子
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
  protected beforeRun(opts: ServiceRunOpts, service: Service) {}

  /**
   * 执行 `applyPlugin('modifyConfig')` 之前的钩子
   */
  protected beforeModifyPluginConfig<T extends PluginConfig>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    opts: ServiceRunOpts,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    config: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    service: Service,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ): T | void {}

  /**
   * 执行 `applyPlugin('modifyPaths')` 之前的钩子
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
  protected beforeModifyPaths<T extends Paths>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    opts: ServiceRunOpts,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    paths: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    service: Service,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ): T | void {}

  /**
   * 执行 `applyPlugin('modifyAppData')' 之前的钩子
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
  protected beforeModifyAppData<T extends AppData>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    opts: ServiceRunOpts,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    appData: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    service: Service,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ): T | void {}
  /**
   * 执行 `run` 方法之后的钩子
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
  protected afterRun(opts: ServiceRunOpts, service: Service) {}

  /**
   * 自定义的预设和插件路径提取器
   */
  protected presetsAndPluginsExtractor(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    presetsOrPlugins: string[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    cwd: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    opts: Record<string, any>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ): string[] {
    return []
  }

  /**
   * 自定义的代理插件API属性提取器
   */
  protected proxyPluginAPIPropsExtractor(): ProxyPluginAPIPropsExtractorReturnType {
    return Object.create(null)
  }

  /**
   * 插件是否可以启用，需要优先满足 `Service#isPluginEnable` 的逻辑
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected isPluginEnableBy(plugin: Plugin): boolean {
    return true
  }

  private _baconPlugins() {
    if (this.args.baconPlugins) {
      console.log()
      for (const id of Object.keys(this.plugins)) {
        const plugin = this.plugins[id]
        console.log(chalk.green('plugin'), plugin.id, plugin.time)
      }
    }
  }
}

export interface ServicePluginAPI {
  // #region 服务自身属性
  /**
   * 当前执行路径
   */
  cwd: typeof Service.prototype.cwd
  /**
   * 其它执行参数
   */
  args: typeof Service.prototype.args
  /**
   * 存储全局数据
   */
  appData: typeof Service.prototype.appData
  /**
   * 项目路径
   */
  paths: Required<typeof Service.prototype.paths>
  /**
   * 插件配置项，是否启用可通过 `modifyConfig` 方法修改
   */
  pluginConfig: typeof Service.prototype.pluginConfig
  // #endregion

  // #region 插件钩子
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
  // #endregion

  // #region 插件和服务方法
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
  // #endregion

  // #region 静态属性
  /**
   * 工具函数
   */
  utils: typeof utils
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
  // #endregion
}
