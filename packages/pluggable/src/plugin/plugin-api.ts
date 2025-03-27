import {
  PluggableStateEnum,
  type Pluggable,
  type PluginDeclaration,
  type ResolvedPlugin,
} from '@/pluggable'
import { type MaybePromiseFunction } from '@eljs/utils'
import assert from 'node:assert'

import { Hook, type HookOptions } from './hook'
import { Plugin } from './plugin'
import { PluginTypeEnum, type Enable } from './types'

/**
 * PluginApi class
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

  public constructor(pluggable: T, plugin: Plugin) {
    this.pluggable = pluggable
    this.plugin = plugin
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
   * @param options 可选配置项
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public registerMethod(name: string, fn?: MaybePromiseFunction<any>): void {
    assert(
      !this.pluggable.pluginMethods[name],
      `api.registerMethod() failed, method \`${name}\` already exist.`,
    )

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
   * @param remainingPresets 待处理预设集合
   * @param presets 待注册预设集合
   */
  public registerPresets(
    remainingPresets: ResolvedPlugin[],
    presets: unknown[],
  ): void {
    assert(
      this.pluggable.state === PluggableStateEnum.InitPresets,
      `api.registerPresets() failed, it should only be used during the presets state.`,
    )

    remainingPresets.unshift(
      ...Plugin.resolvePlugins(
        presets as PluginDeclaration[],
        PluginTypeEnum.Preset,
        this.pluggable.cwd,
      ),
    )
  }

  /**
   * 注册插件
   * @param remainingPlugins 待处理插件集合
   * @param plugins 待注册插件集合
   */
  public registerPlugins(
    remainingPlugins: ResolvedPlugin[],
    plugins: unknown[],
  ): void {
    assert(
      this.pluggable.state === PluggableStateEnum.InitPresets ||
        this.pluggable.state === PluggableStateEnum.InitPlugins,
      `api.registerPlugins() failed, it should only be used during the registering state.`,
    )

    remainingPlugins.unshift(
      ...Plugin.resolvePlugins(
        plugins as PluginDeclaration[],
        PluginTypeEnum.Plugin,
        this.pluggable.cwd,
      ),
    )
  }

  /**
   * 跳过插件
   * @param keys 插件 key
   */
  public skipPlugins(keys: string[]): void {
    for (const key of keys) {
      const plugin = this.pluggable.key2Plugin[key]
      assert(
        !(this.plugin.key === key),
        `Plugin \`${key}\` could not skip itself.`,
      )
      assert(
        plugin,
        `\`${key}\` has not been registered by any plugin, could not be skipped.`,
      )
      this.pluggable.skippedPluginIds.add(plugin.id)
    }
  }
}
