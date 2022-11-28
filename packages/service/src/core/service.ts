import * as utils from '@eljs/utils'
import assert from 'assert'
import fastestLevenshtein from 'fastest-levenshtein'
import _ from 'lodash'
import { AsyncSeriesWaterfallHook } from 'tapable'
import { ConfigManager } from '../config/manager'
import { EnableBy } from '../enum'
import {
  AppData,
  ApplyEvent,
  ApplyModify,
  ApplyPluginsType,
  Args,
  Env,
  Generator,
  Paths,
  PluginConfig,
  PluginType,
  ProxyPluginAPIPropsExtractorReturnType,
  ServiceStage,
  UserConfig,
} from '../types'
import { Command } from './command'
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
   * 目标执行路径
   */
  public target = ''
  /**
   * 当前环境
   */
  public env: Env
  /**
   * 执行 `run` 函数时传入的名字（具体的命令）
   */
  public name = ''
  /**
   * bin 名称
   */
  public binName = ''
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
  public configManager: ConfigManager
  /**
   * 执行阶段
   */
  public stage: string = ServiceStage.Uninitialized
  /**
   * 插件配置项，是否启用可通过 `modifyConfig` 方法修改
   */
  public pluginConfig: PluginConfig = Object.create(null)
  /**
   * 存储全局数据
   */
  public appData: AppData = Object.create(null)
  /**
   * 存储项目路径
   */
  public paths: Paths = {
    cwd: '',
    target: '',
  }
  /**
   * 钩子映射表
   */
  public hooks: Record<string, Hook[]> = Object.create(null)
  /**
   * 命令集合
   */
  public commands: Record<string, Command> = Object.create(null)
  /**
   * 微生成器集合
   */
  public generators: Record<string, Generator> = Object.create(null)
  /**
   * 插件集合
   */
  public plugins: Record<string, Plugin> = Object.create(null)
  /**
   * 插件映射表
   */
  public keyToPluginMap: Record<string, Plugin> = Object.create(null)
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
    assert(
      utils.existsSync(opts.cwd),
      `Invalid cwd ${opts.cwd}, it's not found.`,
    )

    this.opts = opts
    this.cwd = opts.cwd
    this.env = opts.env
    this.binName = opts.binName || 'eljs'
    this._prefix = opts.frameworkName
      ? opts.frameworkName.endsWith('-')
        ? opts.frameworkName
        : `${opts.frameworkName}-`
      : '@eljs/service-'

    this.configManager = new ConfigManager({
      cwd: this.cwd,
      env: this.env,
      defaultConfigFiles: this.opts.defaultConfigFiles,
    })
    this.userConfig = this.configManager.getUserConfig().config
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

    const { serviceProps, staticProps } = this.proxyPluginAPIPropsExtractor()
    const proxyPluginAPI = PluginAPI.proxyPluginAPI({
      service: this,
      pluginAPI,
      serviceProps: _.union(
        [
          'cwd',
          'name',
          'binName',
          'args',
          'userConfig',
          'appData',
          'paths',
          'commands',
          'generators',
          'pluginConfig',
          'applyPlugins',
          'isPluginEnable',
        ],
        serviceProps,
      ),
      staticProps: _.merge(
        {
          ApplyPluginsType,
          EnableBy,
          PluginType,
          service: this,
          utils: utils,
          lodash: _,
        },
        staticProps,
      ),
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
    const { name = '', target = this.cwd, args = {} } = opts

    args._ = args._ || []
    // shift the command itself
    if (args._[0] === name) {
      args._.shift()
    }

    this.name = name
    this.target = target
    this.args = args

    await this.beforeRun(opts, this)

    this.stage = ServiceStage.Init

    const { plugins, presets } = Plugin.getPresetsAndPlugins({
      cwd: this.cwd,
      userConfig: this.userConfig,
      presets: [require.resolve('./service-plugin')].concat(
        this.opts.presets || [],
      ),
      plugins: [require.resolve('./command-plugin')].concat(
        this.opts.plugins || [],
      ) as string[],
      presetsExtractor: this.presetsExtractor,
      pluginsExtractor: this.pluginsExtractor,
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

    if (name && !this.commands[name]) {
      this.commandGuessHelper(Object.keys(this.commands), name)
      throw Error(
        `Invalid command ${utils.chalk.red(name)}, it's not registered.`,
      )
    }

    const pluginConfigInitialValue =
      (await this.beforeModifyPluginConfig(opts, this.pluginConfig, this)) ||
      this.pluginConfig

    // applyPlugin modify plugin config
    this.pluginConfig = await this.applyPlugins({
      key: 'modifyPluginConfig',
      initialValue: pluginConfigInitialValue,
      args: {},
    })

    const defaultPaths = {
      cwd: this.cwd,
      target,
    }
    const pathsInitialValue =
      (await this.beforeModifyPaths(opts, defaultPaths, this)) || defaultPaths

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
      target,
      name,
      args,
    }
    const appDataInitialValue =
      (await this.beforeModifyAppData(opts, defaultAppData, this)) ||
      defaultAppData

    // applyPlugin collect app data
    this.stage = ServiceStage.CollectAppData
    this.appData = await this.applyPlugins({
      key: 'modifyAppData',
      initialValue: appDataInitialValue,
    })

    await this.beforeRunCommand(opts, this)

    // applyPlugin onCheck
    this.stage = ServiceStage.OnCheck
    await this.applyPlugins({
      key: 'onCheck',
    })

    // applyPlugin onStart
    this.stage = ServiceStage.OnStart
    await this.applyPlugins({
      key: 'onStart',
    })

    if (this.commands[name]) {
      this.stage = ServiceStage.RunCommand
      await this.commands[name].fn({ args })
    }

    await this.afterRun(opts, this)

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

  public commandGuessHelper(commands: string[], currentCmd: string) {
    const altCommands = commands.filter(cmd => {
      return (
        fastestLevenshtein.distance(currentCmd, cmd) <
          currentCmd.length * 0.6 && currentCmd !== cmd
      )
    })
    const printHelper = altCommands
      .slice(0, 3)
      .map(cmd => {
        return ` - ${utils.chalk.green(cmd)}`
      })
      .join('\n')

    if (altCommands.length) {
      console.log()
      console.log(
        [
          utils.chalk.cyan(
            altCommands.length === 1
              ? 'Did you mean this command ?'
              : 'Did you mean one of these commands ?',
          ),
          printHelper,
        ].join('\n'),
      )
      console.log()
    }
  }

  /**
   * 执行 `run` 方法之前调用的钩子
   */
  protected async beforeRun(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    opts: ServiceRunOpts,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    service: Service,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ): Promise<void> {}

  /**
   * 执行 `applyPlugin('modifyConfig')` 之前调用的钩子
   */
  protected async beforeModifyPluginConfig<T extends PluginConfig>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    opts: ServiceRunOpts,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    config: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    service: Service,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ): Promise<T | void> {}

  /**
   * 执行 `applyPlugin('modifyPaths')` 之前调用的钩子
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
  protected async beforeModifyPaths<T extends Paths>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    opts: ServiceRunOpts,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    paths: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    service: Service,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ): Promise<T | void> {}

  /**
   * 执行 `applyPlugin('modifyAppData')' 之前调用的钩子
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
  protected async beforeModifyAppData<T extends AppData>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    opts: ServiceRunOpts,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    appData: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    service: Service,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ): Promise<T | void> {}
  /**
   * 执行命令之前的钩子
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
  protected async beforeRunCommand(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    opts: ServiceRunOpts,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    service: Service,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ): Promise<void> {}
  /**
   * 执行 `run` 方法之后的钩子
   */
  protected async afterRun(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    opts: ServiceRunOpts,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    service: Service,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ): Promise<void> {}
  /**
   * 自定义的预设提取器
   */
  protected presetsExtractor(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    presets: string[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    cwd: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    opts: Record<string, any>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ): string[] {
    return []
  }

  /**
   * 自定义的插件提取器
   */
  protected pluginsExtractor(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    plugins: string[],
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
        console.log(utils.chalk.green('plugin'), plugin.id, plugin.time)
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
  // #endregion
}
