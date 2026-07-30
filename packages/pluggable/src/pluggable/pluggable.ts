import { ConfigManager } from '@eljs/config'
import { isFunction, isPathExistsSync } from '@eljs/utils'
import assert from 'node:assert'
import {
  AsyncSeriesBailHook,
  AsyncSeriesHook,
  AsyncSeriesWaterfallHook,
} from 'tapable'

import { PluggableError, PluggableErrorCode } from '../errors'
import {
  Plugin,
  PluginApi,
  PluginTypeEnum,
  type Hook,
  type PluginDiagnostics,
  type PluginReturnType,
  type ResolvedPluginReturnType,
} from '../plugin'
import {
  ApplyPluginTypeEnum,
  PluggableStateEnum,
  type ApplyPluginsOptions,
  type PluggableOptions,
  type PluginDeclaration,
  type PluginMethods,
  type ResolvedPlugin,
  type UserConfig,
} from './types'

/**
 * 可插拔类
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
   * 已跳过 Hook 的插件 ID 集合
   */
  public skippedPluginHookIds: Set<string> = new Set<string>()
  /**
   * 执行阶段
   */
  private _state = PluggableStateEnum.Uninitialized
  /**
   * 单个 Hook 保留的最大调试耗时样本数
   */
  private static readonly _hookTimingSampleLimit = 20

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
    if (this._state !== PluggableStateEnum.Uninitialized) {
      throw new PluggableError(
        PluggableErrorCode.InvalidState,
        `Pluggable.load() can only be called once from the \`${PluggableStateEnum.Uninitialized}\` state, current state is \`${this._state}\`.`,
      )
    }

    this._state = PluggableStateEnum.Init

    try {
      await this._load()
      this._state = PluggableStateEnum.Loaded
    } catch (error) {
      this._resetRuntimeState()
      this._state = PluggableStateEnum.Failed
      throw error
    }
  }

  /**
   * 执行实际加载流程
   */
  private async _load(): Promise<void> {
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
  }

  /**
   * 暴露给子类的扩展钩子
   * 子类可以重写此方法，返回一个对象，向 Plugin API 注入自定义属性或方法
   * @param plugin 当前正在被初始化的插件实例
   * @returns 需要注入到 API 上的扩展对象
   */
  protected extendPluginApi(_plugin: Plugin): Record<string, unknown> {
    return {}
  }

  /**
   * 获取插件 Api
   * @param plugin 插件
   */
  protected _getPluginApi(
    plugin: Plugin,
    remainingPresets: ResolvedPlugin[] = [],
    remainingPlugins: ResolvedPlugin[] = [],
  ): PluginApi {
    // 获取子类提供的扩展对象
    const extensions = this.extendPluginApi(plugin)
    const extensionNames = Object.keys(extensions)
    const pluginApi = new PluginApi(this, plugin, {
      remainingPlugins,
      remainingPresets,
      reservedMethodNames: extensionNames,
    })
    const conflictingExtensionName = extensionNames.find(
      name =>
        name in pluginApi || name in this || Boolean(this.pluginMethods[name]),
    )

    if (conflictingExtensionName) {
      throw new PluggableError(
        PluggableErrorCode.ApiNameConflict,
        `extendPluginApi() failed, property \`${conflictingExtensionName}\` conflicts with a reserved Plugin API name.`,
      )
    }

    return new Proxy(pluginApi, {
      get: (target, prop, receiver) => {
        if (typeof prop !== 'string') {
          return Reflect.get(target, prop, receiver)
        }

        // 1. 子类注入的自定义扩展属性/方法
        if (Object.hasOwn(extensions, prop)) {
          const value = extensions[prop]
          // 如果是函数，绑定 this 到 extensions 对象自身，防止上下文丢失
          return isFunction(value) ? value.bind(extensions) : value
        }

        // 2: 插件通过 api.registerMethod 动态注册的全局方法
        if (this.pluginMethods[prop]) {
          return this.pluginMethods[prop].fn
        }

        // 3: 暴露当前 Pluggable（或其子类）实例上的公开属性/方法
        if (prop in this) {
          const value = this[prop as keyof typeof this]
          return isFunction(value) ? value.bind(this) : value
        }

        // 4: 兜底，访问 PluginApi 自身的原生方法 (如 register, describe)
        return Reflect.get(target, prop, receiver)
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

    const pluginApi = this._getPluginApi(
      plugin,
      remainingPresets,
      remainingPlugins || [],
    )

    const result: ResolvedPluginReturnType = Object.create(null)

    const registrationStart = performance.now()
    let pluginResult: PluginReturnType | void

    try {
      pluginResult = await plugin.apply()(pluginApi, pluginOptions)
    } finally {
      plugin.time.register = performance.now() - registrationStart
    }

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

    // Only presets can return additional presets/plugins
    if (plugin.type === PluginTypeEnum.Preset && pluginResult) {
      if (pluginResult.presets) {
        result.presets = Plugin.resolvePlugins(
          pluginResult.presets,
          PluginTypeEnum.Preset,
          this.cwd,
        )
      }

      if (pluginResult.plugins) {
        result.plugins = Plugin.resolvePlugins(
          pluginResult.plugins,
          PluginTypeEnum.Plugin,
          this.cwd,
        )
      }
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
    if (this._state !== PluggableStateEnum.Loaded) {
      throw new PluggableError(
        PluggableErrorCode.InvalidState,
        `Pluggable.applyPlugins() can only be called from the \`${PluggableStateEnum.Loaded}\` state, current state is \`${this._state}\`.`,
      )
    }

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
              const ret = await this._runHook(hook, key, () => hook.fn(args))
              return ret == null ? memo : (memo as []).concat(ret)
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
              return this._runHook(hook, key, () => hook.fn(memo, args))
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
              const ret = await this._runHook(hook, key, () => hook.fn(args))
              return ret == null ? undefined : ret
            },
          )
        }

        return tapableGet.promise(0) as T
      }

      case ApplyPluginTypeEnum.Event: {
        const tapableEvent = new AsyncSeriesHook(['_'])

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
              await this._runHook(hook, key, () => hook.fn(args))
            },
          )
        }

        await tapableEvent.promise(0)
        return undefined as T
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

    if (this.skippedPluginHookIds.has(id)) {
      return false
    }

    if (typeof enable === 'function') {
      return enable()
    }

    return enable
  }

  /**
   * 获取插件调试信息快照
   */
  public getPluginDiagnostics(): PluginDiagnostics[] {
    return Object.values(this.plugins).map(plugin => ({
      id: plugin.id,
      key: plugin.key,
      path: plugin.path,
      type: plugin.type,
      time: {
        register: plugin.time.register,
        hooks: Object.fromEntries(
          Object.entries(plugin.time.hooks).map(([key, samples]) => [
            key,
            [...samples],
          ]),
        ),
        hookErrors: { ...plugin.time.hookErrors },
      },
    }))
  }

  /**
   * 执行 Hook 并记录有限的调试数据
   */
  private async _runHook<T>(
    hook: Hook,
    key: string,
    fn: () => T | Promise<T>,
  ): Promise<T> {
    const startTime = performance.now()
    let failed = true

    try {
      const result = await fn()
      failed = false
      return result
    } finally {
      const samples = (hook.plugin.time.hooks[key] ||= [])
      samples.push(performance.now() - startTime)

      if (samples.length > Pluggable._hookTimingSampleLimit) {
        samples.splice(0, samples.length - Pluggable._hookTimingSampleLimit)
      }

      if (failed) {
        hook.plugin.time.hookErrors[key] =
          (hook.plugin.time.hookErrors[key] || 0) + 1
      }
    }
  }

  /**
   * 清理失败加载产生的运行期注册数据
   */
  private _resetRuntimeState(): void {
    this.configManager = null
    this.userConfig = null
    this.hooks = Object.create(null)
    this.plugins = Object.create(null)
    this.key2Plugin = Object.create(null)
    this.pluginMethods = Object.create(null)
    this.skippedPluginHookIds = new Set<string>()
  }
}

/**
 * 可插拔插件 Api
 */
export interface PluggablePluginApi {
  // #region 插件类字段
  /**
   * 工作目录
   */
  cwd: typeof Pluggable.prototype.cwd
  // #endregion

  // #region 插件方法
  /**
   * 执行插件
   */
  applyPlugins: typeof Pluggable.prototype.applyPlugins
  /**
   * 获取插件调试信息快照
   */
  getPluginDiagnostics: typeof Pluggable.prototype.getPluginDiagnostics
  /**
   * 注册预设
   * @param presets 预设声明集合
   */
  registerPresets: (presets: PluginDeclaration[]) => void
  /**
   * 注册插件
   * @param plugins 插件声明集合
   */
  registerPlugins: (plugins: PluginDeclaration[]) => void
  // #endregion
}
