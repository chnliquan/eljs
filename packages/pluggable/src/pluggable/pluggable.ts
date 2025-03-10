import { Plugin, PluginApi, PluginTypeEnum, type Hook } from '@/plugin'
import { ConfigManager } from '@eljs/config'
import assert from 'node:assert'
import { AsyncSeriesWaterfallHook } from 'tapable'

import utils, { isFunction, isPathExistsSync } from '@eljs/utils'
import {
  ApplyPluginTypeEnum,
  PluggableStateEnum,
  type ApplyPluginsOptions,
  type PluginMethods,
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
   * 预设路径集合
   */
  presets?: string[]
  /**
   * 预设路径集合
   */
  plugins?: string[]
  /**
   * 默认配置文件列表
   */
  defaultConfigFiles?: string[]
}

/**
 * 用户配置项
 */
export interface UserConfig {
  /**
   * 预设路径列表
   */
  presets?: []
  /**
   * 插件路径列表
   */
  plugins?: []
  /**
   * 扩展字段
   */
  [property: string]: unknown
}

/**
 * 插件配置项
 */
export type PluginConfig = object

/**
 * 可插拔类
 */
export class Pluggable<
  O extends PluggableOptions = PluggableOptions,
  U extends UserConfig = UserConfig,
  P extends PluginConfig = PluginConfig,
> {
  /**
   * 构造函数配置项
   */
  public options: O
  /**
   * 配置文件管理器
   */
  public configManager: ConfigManager
  /**
   * 用户配置项
   */
  public userConfig?: U
  /**
   * 插件自身配置项
   */
  public pluginConfig: P = Object.create(null)
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
    return this.options.cwd
  }

  /**
   * 执行阶段
   */
  public get state(): PluggableStateEnum {
    return this._state
  }

  public constructor(options: O) {
    assert(
      isPathExistsSync(options.cwd),
      `Invalid cwd ${options.cwd}, it's not found.`,
    )

    this.options = options
    this.configManager = new ConfigManager({
      defaultConfigFiles: options.defaultConfigFiles || [],
      cwd: options.cwd,
    })
    this.userConfig = this.configManager.getConfigSync() as U
  }

  /**
   * 加载预设和插件
   */
  protected async load() {
    this._state = PluggableStateEnum.Init

    const { plugins = [], presets = [] } = Plugin.getPresetsAndPlugins(
      this.cwd,
      (this.options.presets || []).concat(this.userConfig?.presets || []),
      (this.options.plugins || []).concat(this.userConfig?.plugins || []),
    )

    // #region register presets
    this._state = PluggableStateEnum.InitPresets

    const resolvedPlugins: Plugin[] = []
    while (presets.length) {
      await this._initPreset(
        presets.shift() as Plugin,
        presets,
        resolvedPlugins,
      )
    }
    // #endregion

    // #region register plugins
    plugins.unshift(...resolvedPlugins)
    this._state = PluggableStateEnum.InitPlugins

    while (plugins.length) {
      await this._initPlugin(plugins.shift() as Plugin, plugins)
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

    const extraApi = {
      utils,
    }

    return new Proxy(pluginApi, {
      get: (target, prop: string) => {
        if (this.pluginMethods[prop]) {
          return this.pluginMethods[prop].fn
        }

        if (prop in this) {
          const value = this[prop as keyof typeof this]
          return isFunction(value) ? value.bind(this) : value
        }

        if (prop in extraApi) {
          return extraApi[prop as keyof typeof extraApi]
        }

        return target[prop as keyof typeof target]
      },
    })
  }

  /**
   * 初始化预设
   * @param preset 预设
   * @param resolvedPresets 解析后的预设集合
   * @param resolvedPlugins 解析后的插件集合
   */
  private async _initPreset(
    preset: Plugin,
    resolvedPresets: Plugin[],
    resolvedPlugins: Plugin[],
  ) {
    const { presets = [], plugins = [] } = await this._initPlugin(
      preset,
      resolvedPresets,
      resolvedPresets,
    )
    resolvedPresets.unshift(...presets)
    resolvedPlugins.push(...plugins)
  }

  /**
   * 初始化插件
   * @param plugin 插件
   * @param resolvedPresets 解析后的预设集合
   * @param resolvedPlugins 解析后的插件集合
   */
  private async _initPlugin(
    plugin: Plugin,
    resolvedPresets: Plugin[],
    resolvedPlugins?: Plugin[],
  ) {
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
      resolvedPresets,
    )

    pluginApi.registerPlugins = pluginApi.registerPlugins.bind(
      pluginApi,
      resolvedPlugins || [],
    )

    const ret: {
      presets: Plugin[]
      plugins: Plugin[]
    } = Object.create(null)

    const startTime = new Date()
    const pluginRet = await plugin.apply()(pluginApi)
    plugin.time.register = new Date().getTime() - startTime.getTime()

    if (plugin.type === PluginTypeEnum.Plugin) {
      assert(!pluginRet, `plugin should return nothing.`)
    }

    assert(
      !this.key2Plugin[plugin.key],
      `key ${plugin.key} is already registered by ${
        this.key2Plugin[plugin.key]?.path
      }, ${plugin.type} from ${plugin.path} register failed.`,
    )

    this.key2Plugin[plugin.key] = plugin

    if (pluginRet?.presets) {
      ret.presets = pluginRet.presets.map(
        (preset: string) =>
          new Plugin({
            path: preset,
            type: PluginTypeEnum.Preset,
            cwd: this.cwd,
          }),
      )
    }

    if (pluginRet?.plugins) {
      ret.plugins = pluginRet.plugins.map(
        plugin =>
          new Plugin({
            path: plugin,
            type: PluginTypeEnum.Plugin,
            cwd: this.cwd,
          }),
      )
    }

    // merge plugin config
    this.pluginConfig = {
      ...this.pluginConfig,
      ...plugin.config,
    }

    return ret
  }

  /**
   * 执行插件
   * @param key 通过 register 方法注册的 key
   * @param options 配置项
   */
  public async applyPlugins<T extends object, U extends object>(
    key: string,
    options?: ApplyPluginsOptions<T, U>,
  ): Promise<T> {
    let { type } = options || {}

    // guess type from key
    if (!type) {
      if (key.startsWith('on')) {
        type = ApplyPluginTypeEnum.Event
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
    const { initialValue, args } = options || {}

    switch (type) {
      case ApplyPluginTypeEnum.Add: {
        assert(
          !(options && 'initialValue' in options) ||
            Array.isArray(initialValue),
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
              const items = await hook.fn(args)
              hook.plugin.time.hooks[key] ||= []
              hook.plugin.time.hooks[key].push(
                new Date().getTime() - startTime.getTime(),
              )
              return (memo as []).concat(items)
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
              const modified = await hook.fn(memo, args)
              hook.plugin.time.hooks[key] ||= []
              hook.plugin.time.hooks[key].push(
                new Date().getTime() - startTime.getTime(),
              )
              return modified
            },
          )
        }

        return tapableModify.promise(initialValue) as T
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
              stage: hook.stage || 0,
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

        return tapableEvent.promise(1) as T
      }

      default:
        throw new Error(
          `applyPlugins failed, type is not defined or is not matched, got ${type}.`,
        )
    }
  }

  /**
   * 插件是否可执行
   * @param hook 钩子
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
 * 可插拔插件 API
 */
export interface PluggablePluginApi {
  // #region 插件属性
  /**
   * 当前执行路径
   */
  cwd: typeof Pluggable.prototype.cwd
  /**
   * 插件自身配置项
   */
  pluginConfig: typeof Pluggable.prototype.pluginConfig
  // #endregion

  // #region 插件方法
  /**
   * 执行插件
   */
  applyPlugins: typeof Pluggable.prototype.applyPlugins
  /**
   * 注册预设
   * @param presets 预设路径集合
   */
  registerPresets: (presets: string[]) => void
  /**
   * 注册插件
   * @param plugins 插件/路径集合
   */
  registerPlugins: (plugins: (Plugin | string)[]) => void
  // #endregion

  // #region 静态属性
  /**
   * 工具函数
   */
  utils: typeof utils
  // #endregion
}
