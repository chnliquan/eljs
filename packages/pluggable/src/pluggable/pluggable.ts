import {
  Plugin,
  PluginApi,
  PluginTypeEnum,
  type Hook,
  type ResolvedPluginReturnType,
} from '@/plugin'
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
 * Pluggable constructor options
 */
export interface PluggableOptions {
  /**
   * Working directory
   * @default process.cwd()
   */
  cwd: string
  /**
   * Preset declarations
   */
  presets?: PluginDeclaration[]
  /**
   * Plugin declarations
   */
  plugins?: PluginDeclaration[]
  /**
   * Default config files
   * @example
   * ['config.ts', 'config.js']
   */
  defaultConfigFiles?: string[]
  /**
   * Default config file extensions
   * @example
   * ['dev', 'staging'] => ['config.dev.ts', 'config.staging.ts']
   */
  defaultConfigExts?: string[]
}

/**
 * Pluggable class
 */
export class Pluggable<T extends UserConfig = UserConfig> {
  /**
   * 构造函数选项
   */
  public constructorOptions: PluggableOptions
  /**
   * 配置文件管理器
   */
  public configManager: ConfigManager | null = null
  /**
   * 用户配置项
   */
  public userConfig: T | null = null
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
      `Invalid cwd ${options.cwd}, could not be found.`,
    )
    this.constructorOptions = options
  }

  /**
   * 加载预设和插件
   */
  protected async load(): Promise<void> {
    this._state = PluggableStateEnum.Init

    this.configManager = new ConfigManager({
      defaultConfigFiles: this.constructorOptions.defaultConfigFiles || [],
      defaultConfigExts: this.constructorOptions.defaultConfigExts,
      cwd: this.constructorOptions.cwd,
    })
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
   * 获取插件 Api
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
  ): Promise<void> {
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
  ): Promise<ResolvedPluginReturnType> {
    const [plugin, pluginOptions] = currentPlugin
    assert(
      !this.plugins[plugin.id],
      `${plugin.type} \`${plugin.id}\` has already been registered by ${
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

    const result: ResolvedPluginReturnType = Object.create(null)

    const registrationStart = new Date()
    const pluginResult = await plugin.apply()(pluginApi, pluginOptions)
    plugin.time.register = new Date().getTime() - registrationStart.getTime()

    if (plugin.type === PluginTypeEnum.Plugin) {
      assert(!pluginResult, `Plugin should return nothing.`)
    }

    assert(
      !this.key2Plugin[plugin.key],
      `\`${plugin.key}\` has already been registered by ${
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
          `Invalid applyPlugins arguments, \`type\` must be supplied for key \`${key}\`.`,
        )
      }
    }

    const hooks = this.hooks[key] || []
    const { initialValue, args } = options

    switch (type) {
      case ApplyPluginTypeEnum.Add: {
        assert(
          !('initialValue' in options) || Array.isArray(initialValue),
          `ApplyPlugins failed, \`options.initialValue\` must be an array when \`options.type\` is add.`,
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
          `ApplyPlugins failed, \`type\` not defined or matched, got \`${type}\`.`,
        )
    }
  }

  /**
   * 插件是否可执行
   * @param hook 钩子/插件名
   */
  protected isPluginEnable(hook: Hook | string): boolean {
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

    if (typeof enable === 'function') {
      return enable()
    }

    return true
  }
}

/**
 * Pluggable plugin api
 */
export interface PluggablePluginApi {
  // #region Plugin class fields
  /**
   * Working directory
   */
  cwd: typeof Pluggable.prototype.cwd
  // #endregion

  // #region Plugin methods
  /**
   * Apply plugins
   */
  applyPlugins: typeof Pluggable.prototype.applyPlugins
  /**
   * Register presets
   * @param presets preset declarations
   */
  registerPresets: (presets: PluginDeclaration[]) => void
  /**
   * Register plugins
   * @param plugins plugin declarations
   */
  registerPlugins: (plugins: PluginDeclaration[]) => void
  // #endregion
}
