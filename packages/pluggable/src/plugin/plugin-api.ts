import { type MaybePromiseFunction } from '@eljs/utils'
import assert from 'node:assert'

import { PluggableError, PluggableErrorCode } from '../errors'
import {
  PluggableStateEnum,
  type Pluggable,
  type PluginDeclaration,
  type ResolvedPlugin,
} from '../pluggable'
import { Hook, type HookOptions } from './hook'
import { Plugin } from './plugin'
import { PluginTypeEnum, type Enable } from './types'

/**
 * 插件 Api 内部上下文
 */
export interface PluginApiOptions {
  /**
   * 子类扩展占用的方法名
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
 * 插件 Api 类
 */
export class PluginApi<T extends Pluggable = Pluggable> {
  /**
   * 可插拔类实例
   */
  public pluggable: T
  /**
   * 插件
   */
  public plugin: Plugin
  /**
   * 子类扩展占用的方法名
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

  public constructor(
    pluggable: T,
    plugin: Plugin,
    options: PluginApiOptions = {},
  ) {
    this.pluggable = pluggable
    this.plugin = plugin
    this._reservedMethodNames = new Set(options.reservedMethodNames)
    this._remainingPresets = options.remainingPresets || []
    this._remainingPlugins = options.remainingPlugins || []
  }

  /**
   * 描述插件
   * @param options.key 插件 key
   * @param options.enable 插件是否可以执行
   */
  public describe(options: { key?: string; enable?: Enable }) {
    this.plugin.merge(options)
  }

  /**
   * 注册插件
   * @param key 唯一标识
   * @param fn 执行函数
   * @param options 选项
   */
  public register(
    key: HookOptions['key'],
    fn: HookOptions['fn'],
    options: Omit<HookOptions, 'plugin' | 'key' | 'fn'> = {},
  ): void {
    this.pluggable.hooks[key] ||= []
    this.pluggable.hooks[key].push(
      new Hook({ ...options, key, fn, plugin: this.plugin }),
    )
  }

  /**
   * 注册方法
   * @param name 方法名
   * @param fn 执行函数
   */
  public registerMethod(name: string, fn?: MaybePromiseFunction): void {
    assert(
      !this.pluggable.pluginMethods[name],
      `api.registerMethod() failed, method \`${name}\` already exist.`,
    )

    if (
      !name ||
      name in this ||
      name in this.pluggable ||
      this._reservedMethodNames.has(name)
    ) {
      throw new PluggableError(
        PluggableErrorCode.ApiNameConflict,
        `api.registerMethod() failed, method \`${name}\` conflicts with a reserved Plugin API name.`,
      )
    }

    this.pluggable.pluginMethods[name] = {
      plugin: this.plugin,
      fn:
        fn ||
        // 这里不能用 arrow function，this 需指向执行此方法的 pluginApi
        // 否则 pluginId 会不对，导致不能正确 skip plugin
        function fn(
          this: PluginApi,
          fn: HookOptions['fn'],
          options: Omit<HookOptions, 'plugin' | 'key' | 'fn'> = {},
        ) {
          this.register(name, fn, options)
        },
    }
  }

  /**
   * 注册预设
   * @param presets 待注册预设集合
   */
  public registerPresets(presets: PluginDeclaration[]): void {
    assert(
      this.pluggable.state === PluggableStateEnum.InitPresets,
      `api.registerPresets() failed, it should only be used during the presets state.`,
    )

    this._remainingPresets.unshift(
      ...Plugin.resolvePlugins(
        presets,
        PluginTypeEnum.Preset,
        this.pluggable.cwd,
      ),
    )
  }

  /**
   * 注册插件
   * @param plugins 待注册插件集合
   */
  public registerPlugins(plugins: PluginDeclaration[]): void {
    assert(
      this.pluggable.state === PluggableStateEnum.InitPresets ||
        this.pluggable.state === PluggableStateEnum.InitPlugins,
      `api.registerPlugins() failed, it should only be used during the registering state.`,
    )

    this._remainingPlugins.unshift(
      ...Plugin.resolvePlugins(
        plugins,
        PluginTypeEnum.Plugin,
        this.pluggable.cwd,
      ),
    )
  }

  /**
   * 跳过插件 Hook
   *
   * 该方法不会阻止插件初始化，也不会撤销插件注册的方法或初始化副作用。
   * @param keys 插件 key
   */
  public skipPluginHooks(keys: string[]): void {
    for (const key of keys) {
      const plugin = this.pluggable.key2Plugin[key]
      assert(
        !(this.plugin.key === key),
        `Plugin \`${key}\` could not skip itself.`,
      )
      assert(
        plugin,
        `\`${key}\` has not been registered by any plugin, its hooks could not be skipped.`,
      )
      this.pluggable.skippedPluginHookIds.add(plugin.id)
    }
  }
}
