import { Plugin, PluginApi, PluginTypeEnum, type Hook } from '@/plugin'
import { ConfigManager } from '@eljs/config'
import { isFunction, isPathExistsSync } from '@eljs/utils'
import assert from 'node:assert'
import { AsyncSeriesBailHook, AsyncSeriesWaterfallHook } from 'tapable'

import {
  ApplyPluginTypeEnum,
  PluggableStateEnum,
  type ApplyPluginsOptions,
  type PluginDeclaration,
  type PluginMethods,
  type ResolvedPlugin,
  type UserConfig,
} from './types'

/**
 * 可插拔类参数
 */
export interface PluggableOptions {
  /**
   * 当前工作目录
   */
  cwd: string
  /**
   * 预设定义集合
   */
  presets?: PluginDeclaration[]
  /**
   * 插件定义集合
   */
  plugins?: PluginDeclaration[]
  /**
   * 默认配置文件（config.ts）
   */
  defaultConfigFiles: string[]
  /**
   * 默认配置文件扩展（dev => config.dev.ts，prod => config.prod.ts）
   */
  defaultConfigExts?: string[]
}

/**
 * 可插拔类
 */
export class Pluggable<T extends UserConfig = UserConfig> {
  /**
   * 构造函数参数
   */
  public constructorOptions: PluggableOptions
  /**
   * 配置文件管理器
   */
  public configManager: ConfigManager
  /**
   * 用户配置项
   */
  public userConfig: T = Object.create(null)
  /**
   * 钩子映射表
   */
  public hooks: Record<string, Hook[]> = Object.create(null)
  /**
   * 插件集合
   */
  public plugins: Record<string, Plugin> = Object.create(null)
  /**
   * 插件映射表
   */
  public key2Plugin: Record<string, Plugin> = Object.create(null)
  /**
   * 插件方法集合
   */
  public pluginMethods: PluginMethods = Object.create(null)
  /**
   * 已跳过插件 ID 集合
   */
  public skippedPluginIds: Set<string> = new Set<string>()
  /**
   * 执行阶段
   */
  private _state = PluggableStateEnum.Uninitialized

  /**
   * 当前工作目录
   */
  public get cwd(): string {
    return this.constructorOptions.cwd
  }

  /**
   * 执行阶段
   */
  public get state(): PluggableStateEnum {
    return this._state
  }

  public constructor(options: PluggableOptions) {
    assert(
      isPathExistsSync(options.cwd),
      `Invalid cwd ${options.cwd}, it's not found.`,
    )

    this.constructorOptions = options
    this.configManager = new ConfigManager({
      defaultConfigFiles: options.defaultConfigFiles || [],
      defaultConfigExts: options.defaultConfigExts,
      cwd: options.cwd,
    })
  }

  /**
   * 加载预设和插件
   */
  protected async load() {
    this._state = PluggableStateEnum.Init

    this.userConfig = (await this.configManager.getConfig()) as T

    const constructorPresets = this.constructorOptions.presets || []
    const userPresets = this.userConfig?.presets || []
    const constructorPlugins = this.constructorOptions.plugins || []
    const userPlugins = this.userConfig?.plugins || []

    const { plugins = [], presets = [] } = Plugin.getPresetsAndPlugins(
      this.constructorOptions.cwd,
      [...constructorPresets, ...userPresets],
      [...constructorPlugins, ...userPlugins],
    )

    // #region register presets
    this._state = PluggableStateEnum.InitPresets

    // 预设返回的插件集合
    const pluginsFromPresets: ResolvedPlugin[] = []
    while (presets.length) {
      await this._initPreset(
        presets.shift() as ResolvedPlugin,
        presets,
        pluginsFromPresets,
      )
    }
    // #endregion

    // #region register plugins
    plugins.unshift(...pluginsFromPresets)
    this._state = PluggableStateEnum.InitPlugins

    while (plugins.length) {
      await this._initPlugin(plugins.shift() as ResolvedPlugin, plugins)
    }
    // #endregion

    this._state = PluggableStateEnum.Loaded
  }

  /**
   * 获取插件 API
   * @param plugin 插件
   */
  protected getPluginApi(plugin: Plugin): PluginApi {
    const pluginApi = new PluginApi(this, plugin)

    return new Proxy(pluginApi, {
      get: (target, prop: string) => {
        if (this.pluginMethods[prop]) {
          return this.pluginMethods[prop].fn
        }

        if (prop in this) {
          const value = this[prop as keyof typeof this]
          return isFunction(value) ? value.bind(this) : value
        }

        return target[prop as keyof typeof target]
      },
    })
  }

  /**
   * 初始化预设
   * @param currentPreset 当前预设
   * @param remainingPresets 待处理预设集合
   * @param pluginsFromPresets 预设返回的插件集合
   */
  private async _initPreset(
    currentPreset: ResolvedPlugin,
    remainingPresets: ResolvedPlugin[],
    pluginsFromPresets: ResolvedPlugin[],
  ) {
    const { presets: nestedPresets = [], plugins: nestedPlugins = [] } =
      await this._initPlugin(
        currentPreset,
        remainingPresets,
        pluginsFromPresets,
      )

    remainingPresets.unshift(...nestedPresets)
    pluginsFromPresets.push(...nestedPlugins)
  }

  /**
   * 初始化插件
   * @param currentPlugin 当前插件
   * @param remainingPresets 待处理预设集合
   * @param remainingPlugins 待处理插件集合
   */
  private async _initPlugin(
    currentPlugin: ResolvedPlugin,
    remainingPresets: ResolvedPlugin[],
    remainingPlugins?: ResolvedPlugin[],
  ) {
    const [plugin, pluginOptions] = currentPlugin
    assert(
      !this.plugins[plugin.id],
      `${plugin.type} ${plugin.id} is already registered by ${
        this.plugins[plugin.id]?.path
      }, ${plugin.type} from ${plugin.path} register failed.`,
    )

    this.plugins[plugin.id] = plugin

    const pluginApi = this.getPluginApi(plugin)

    pluginApi.registerPresets = pluginApi.registerPresets.bind(
      pluginApi,
      remainingPresets,
    )

    pluginApi.registerPlugins = pluginApi.registerPlugins.bind(
      pluginApi,
      remainingPlugins || [],
    )

    const result: {
      presets: ResolvedPlugin[]
      plugins: ResolvedPlugin[]
    } = Object.create(null)

    const registrationStart = new Date()
    const pluginResult = await plugin.apply()(pluginApi, pluginOptions)
    plugin.time.register = new Date().getTime() - registrationStart.getTime()

    if (plugin.type === PluginTypeEnum.Plugin) {
      assert(!pluginResult, `plugin should return nothing.`)
    }

    assert(
      !this.key2Plugin[plugin.key],
      `key ${plugin.key} is already registered by ${
        this.key2Plugin[plugin.key]?.path
      }, ${plugin.type} from ${plugin.path} register failed.`,
    )

    this.key2Plugin[plugin.key] = plugin

    if (pluginResult?.presets) {
      result.presets = Plugin.resolvePlugins(
        pluginResult.presets,
        PluginTypeEnum.Preset,
        this.cwd,
      )
    }

    if (pluginResult?.plugins) {
      result.plugins = Plugin.resolvePlugins(
        pluginResult.plugins,
        PluginTypeEnum.Plugin,
        this.cwd,
      )
    }

    return result
  }

  /**
   * 执行插件
   * @param key 通过 register 方法注册的 key
   * @param options 配置项
   */
  public async applyPlugins<T, U>(
    key: string,
    options: ApplyPluginsOptions<T, U> = {},
  ): Promise<T> {
    let { type } = options

    // guess type from key
    if (!type) {
      if (key.startsWith('on')) {
        type = ApplyPluginTypeEnum.Event
      } else if (key.startsWith('get')) {
        type = ApplyPluginTypeEnum.Get
      } else if (key.startsWith('modify')) {
        type = ApplyPluginTypeEnum.Modify
      } else if (key.startsWith('add')) {
        type = ApplyPluginTypeEnum.Add
      } else {
        throw new Error(
          `Invalid applyPlugins arguments, type must be supplied for key ${key}.`,
        )
      }
    }

    const hooks = this.hooks[key] || []
    const { initialValue, args } = options

    switch (type) {
      case ApplyPluginTypeEnum.Add: {
        assert(
          !('initialValue' in options) || Array.isArray(initialValue),
          `applyPlugins failed, \`options.initialValue\` must be Array if \`options.type\` is add.`,
        )

        const tapableAdd = new AsyncSeriesWaterfallHook(['memo'])

        for (const hook of hooks) {
          if (!this.isPluginEnable(hook)) {
            continue
          }

          tapableAdd.tapPromise(
            {
              name: hook.plugin.key,
              stage: hook.stage,
              before: hook.before,
            },
            async memo => {
              const startTime = new Date()
              const ret = await hook.fn(args)
              hook.plugin.time.hooks[key] ||= []
              hook.plugin.time.hooks[key].push(
                new Date().getTime() - startTime.getTime(),
              )
              return (memo as []).concat(ret)
            },
          )
        }

        return tapableAdd.promise(initialValue || []) as T
      }

      case ApplyPluginTypeEnum.Modify: {
        const tapableModify = new AsyncSeriesWaterfallHook(['memo'])

        for (const hook of hooks) {
          if (!this.isPluginEnable(hook)) {
            continue
          }

          tapableModify.tapPromise(
            {
              name: hook.plugin.key,
              stage: hook.stage,
              before: hook.before,
            },
            async memo => {
              const startTime = new Date()
              const ret = await hook.fn(memo, args)
              hook.plugin.time.hooks[key] ||= []
              hook.plugin.time.hooks[key].push(
                new Date().getTime() - startTime.getTime(),
              )
              return ret
            },
          )
        }

        return tapableModify.promise(initialValue) as T
      }

      case ApplyPluginTypeEnum.Get: {
        const tapableGet = new AsyncSeriesBailHook(['_'])

        for (const hook of hooks) {
          if (!this.isPluginEnable(hook)) {
            continue
          }

          tapableGet.tapPromise(
            {
              name: hook.plugin.key,
              stage: hook.stage,
              before: hook.before,
            },
            async () => {
              const startTime = new Date()
              const ret = await hook.fn(args)
              hook.plugin.time.hooks[key] ||= []
              hook.plugin.time.hooks[key].push(
                new Date().getTime() - startTime.getTime(),
              )
              return ret
            },
          )
        }

        return tapableGet.promise(0) as T
      }

      case ApplyPluginTypeEnum.Event: {
        const tapableEvent = new AsyncSeriesWaterfallHook(['_'])

        for (const hook of hooks) {
          if (!this.isPluginEnable(hook)) {
            continue
          }

          tapableEvent.tapPromise(
            {
              name: hook.plugin.key,
              stage: hook.stage,
              before: hook.before,
            },
            async () => {
              const startTime = new Date()
              await hook.fn(args)
              hook.plugin.time.hooks[key] ||= []
              hook.plugin.time.hooks[key].push(
                new Date().getTime() - startTime.getTime(),
              )
            },
          )
        }

        return tapableEvent.promise(0) as T
      }

      default:
        throw new Error(
          `applyPlugins failed, type is not defined or is not matched, got ${type}.`,
        )
    }
  }

  /**
   * 插件是否可执行
   * @param hook 钩子/插件名
   */
  protected isPluginEnable(hook: Hook | string) {
    let plugin: Plugin

    if ((hook as Hook).plugin) {
      plugin = (hook as Hook).plugin
    } else {
      plugin = this.key2Plugin[hook as string]
    }

    const { id, enable } = plugin

    if (this.skippedPluginIds.has(id)) {
      return false
    }

    if (isFunction(enable)) {
      return enable()
    }

    return true
  }
}

/**
 * 可插拔类插件 Api
 */
export interface PluggablePluginApi {
  // #region 插件属性
  /**
   * 当前执行路径
   */
  cwd: typeof Pluggable.prototype.cwd
  // #endregion

  // #region 插件方法
  /**
   * 执行插件
   */
  applyPlugins: typeof Pluggable.prototype.applyPlugins
  /**
   * 注册预设
   * @param presets 预设定义集合
   */
  registerPresets: (presets: PluginDeclaration[]) => void
  /**
   * 注册插件
   * @param plugins 插件定义集合
   */
  registerPlugins: (plugins: PluginDeclaration[]) => void
  // #endregion
}
