import { type MaybePromiseFunction } from '@eljs/utils'

import {
  PluginHostState,
  type PluginDeclaration,
  type PluginOrigin,
  type ResolvedPlugin,
} from '../core/types'
import { PluginHostError, PluginHostErrorCode } from '../errors'
import { Hook, type HookOptions } from './hook'
import { Plugin } from './plugin'
import {
  type PluginHookEnablement,
  type PluginMetadata,
  type PluginType,
} from './types'

/**
 * `PluginApi` 访问插件宿主所需的最小上下文
 *
 * @internal
 */
export interface PluginApiHostContext {
  /**
   * 当前工作目录
   */
  readonly cwd: string
  /**
   * 当前插件宿主状态
   */
  readonly state: PluginHostState
  /**
   * 注册一个 Hook
   *
   * @param hook - Hook 注册记录
   */
  registerHook(hook: Hook): void
  /**
   * 注册插件提供的显式方法
   *
   * @param name - 方法名称
   * @param plugin - 提供方法的插件
   * @param fn - 方法实现
   */
  registerPluginCapability(
    name: string,
    plugin: Plugin,
    fn: MaybePromiseFunction,
  ): void
  /**
   * 记录跳过目标插件 Hook 的请求
   *
   * @param requester - 发起请求的插件
   * @param targetKeys - 目标插件 key 集合
   */
  requestPluginHookDisable(
    requester: Plugin,
    targetKeys: readonly string[],
  ): void
  /**
   * 解析一组插件声明
   *
   * @param declarations - 待解析声明
   * @param type - 插件类型
   * @param origin - 声明来源
   * @returns 解析后的插件元组
   */
  resolvePlugins(
    declarations: readonly PluginDeclaration[],
    type: PluginType,
    origin: Omit<PluginOrigin, 'declaration'>,
  ): ResolvedPlugin[]
}

/**
 * 创建 `PluginApi` 时使用的内部选项
 *
 * @internal
 */
export interface PluginApiOptions {
  /**
   * 宿主上下文占用的方法名
   */
  reservedMethodNames?: Iterable<string>
  /**
   * 当前加载流程待处理的预设
   */
  remainingPresets?: ResolvedPlugin[]
  /**
   * 当前加载流程待处理的插件
   */
  remainingPlugins?: ResolvedPlugin[]
}

/**
 * 提供给插件入口函数的核心运行时 API
 */
export class PluginApi {
  /**
   * 插件宿主上下文，仅供 `PluginApi` 内部协调生命周期状态
   */
  private readonly _host: PluginApiHostContext
  /**
   * 当前正在初始化的插件实例
   */
  private readonly _plugin: Plugin
  /**
   * 宿主上下文占用的方法名
   */
  private readonly _reservedMethodNames: Set<string>
  /**
   * 当前加载流程待处理的预设
   */
  private readonly _remainingPresets: ResolvedPlugin[]
  /**
   * 当前加载流程待处理的插件
   */
  private readonly _remainingPlugins: ResolvedPlugin[]

  /**
   * 创建插件 API
   *
   * @param host - 最小插件宿主上下文
   * @param plugin - 当前正在初始化的插件
   * @param options - 当前加载队列及保留方法名
   *
   * @internal
   */
  public constructor(
    host: PluginApiHostContext,
    plugin: Plugin,
    options: PluginApiOptions = {},
  ) {
    this._host = host
    this._plugin = plugin
    this._reservedMethodNames = new Set(options.reservedMethodNames)
    this._remainingPresets = options.remainingPresets || []
    this._remainingPlugins = options.remainingPlugins || []

    for (const name of [
      '_host',
      '_plugin',
      '_remainingPlugins',
      '_remainingPresets',
      '_reservedMethodNames',
    ] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(this, name)
      if (descriptor) {
        Object.defineProperty(this, name, {
          ...descriptor,
          enumerable: false,
        })
      }
    }
  }

  /**
   * 当前工作目录
   *
   * @returns `PluginHost` 实例的工作目录
   */
  public get cwd(): string {
    return this._host.cwd
  }

  /**
   * 当前插件的只读元数据
   *
   * @returns 与内部插件实例隔离的元数据快照
   */
  public get plugin(): PluginMetadata {
    return this._plugin.getMetadata()
  }

  /**
   * 更新当前插件的公开标识和 Hook 启用条件
   *
   * @param options - 插件 key 和 Hook 启用条件
   */
  public describe(options: {
    key?: string
    enable?: PluginHookEnablement
  }): void {
    this._plugin.configure(options)
  }

  /**
   * 注册一个底层 Hook 处理函数
   *
   * @remarks
   * 提供 Hook Schema 时，优先使用由 Schema 生成的具名注册方法
   *
   * @param key - Hook 唯一标识
   * @param fn - Hook 处理函数
   * @param options - Hook 执行顺序配置
   * @throws {@link PluginHostError}
   * 当 Hook 不在 Schema 中或定义无效时抛出
   */
  public register(
    key: HookOptions['key'],
    fn: HookOptions['fn'],
    options: Omit<HookOptions, 'plugin' | 'key' | 'fn'> = {},
  ): void {
    this._host.registerHook(
      new Hook({ ...options, key, fn, plugin: this._plugin }),
    )
  }

  /**
   * 注册一个插件提供的显式 API 方法
   *
   * @param name - 方法名
   * @param fn - 方法实现
   * @throws {@link PluginHostError}
   * 当方法名与核心 API、Hook Schema 或已有方法冲突时抛出
   */
  public registerCapability(name: string, fn: MaybePromiseFunction): void {
    if (typeof name !== 'string' || !name.trim() || name !== name.trim()) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidOptions,
        `PluginApi.registerCapability() failed, capability name must be a non-empty string.`,
        { details: { capabilityName: name } },
      )
    }

    if (name in this || this._reservedMethodNames.has(name)) {
      throw new PluginHostError(
        PluginHostErrorCode.ApiNameConflict,
        `PluginApi.registerCapability() failed, capability \`${name}\` conflicts with a reserved Plugin API name.`,
      )
    }

    if (typeof fn !== 'function') {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidOptions,
        `PluginApi.registerCapability() failed, capability \`${name}\` must be a function.`,
        { details: { capabilityName: name } },
      )
    }

    this._host.registerPluginCapability(name, this._plugin, fn)
  }

  /**
   * 向当前初始化队列注册更多 preset
   *
   * @param presets - 待注册的 preset 声明
   * @throws {@link PluginHostError}
   * 当调用时机不在 preset 初始化阶段或声明无法解析时抛出
   */
  public registerPresets(presets: readonly PluginDeclaration[]): void {
    if (this._host.state !== PluginHostState.LoadingPresets) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidState,
        `PluginApi.registerPresets() can only be called while PluginHost is loading presets.`,
        { details: { state: this._host.state } },
      )
    }

    this._remainingPresets.unshift(
      ...this._host.resolvePlugins(presets, 'preset', {
        source: 'plugin-api',
        parentPlugin: this._getParentPluginOrigin(),
      }),
    )
  }

  /**
   * 向当前初始化队列注册更多 plugin
   *
   * @param plugins - 待注册的 plugin 声明
   * @throws {@link PluginHostError}
   * 当调用时机不在注册阶段或声明无法解析时抛出
   */
  public registerPlugins(plugins: readonly PluginDeclaration[]): void {
    if (
      this._host.state !== PluginHostState.LoadingPresets &&
      this._host.state !== PluginHostState.LoadingPlugins
    ) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidState,
        `PluginApi.registerPlugins() can only be called while PluginHost is loading presets or plugins.`,
        { details: { state: this._host.state } },
      )
    }

    this._remainingPlugins.unshift(
      ...this._host.resolvePlugins(plugins, 'plugin', {
        source: 'plugin-api',
        parentPlugin: this._getParentPluginOrigin(),
      }),
    )
  }

  /**
   * 请求跳过指定插件注册的全部 Hook
   *
   * @remarks
   * 该方法不会阻止插件初始化，也不会撤销插件注册的方法或初始化副作用
   * 跳过请求会在全部插件注册完成后统一解析，因此不依赖声明顺序
   *
   * @param keys - 目标插件 key 集合
   */
  public disablePluginHooks(keys: readonly string[]): void {
    if (
      !Array.isArray(keys) ||
      keys.some(
        key => typeof key !== 'string' || !key.trim() || key !== key.trim(),
      )
    ) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidOptions,
        `PluginApi.disablePluginHooks() failed, plugin keys must be non-empty strings.`,
        { details: { pluginKeys: keys } },
      )
    }

    this._host.requestPluginHookDisable(this._plugin, keys)
  }

  /**
   * 创建当前插件的来源快照
   *
   * @returns 用于子声明来源追踪的插件信息
   */
  private _getParentPluginOrigin() {
    const { id, key, path, type } = this._plugin
    return { id, key, path, type }
  }
}
