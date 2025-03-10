import { PluggableStateEnum, type Pluggable } from '@/pluggable'
import { isPlainObject, isString, type MaybePromiseFunction } from '@eljs/utils'
import assert from 'node:assert'

import { Hook, type HookOptions } from './hook'
import { Plugin } from './plugin'
import { PluginTypeEnum, type Enable } from './types'

/**
 * 插件 API 类
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
  ) {
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
  public registerMethod(name: string, fn?: MaybePromiseFunction<any>) {
    assert(
      !this.pluggable.pluginMethods[name],
      `api.registerMethod() failed, method ${name} is already exist.`,
    )

    this.pluggable.pluginMethods[name] = {
      plugin: this.plugin,
      fn:
        fn ||
        // 这里不能用 arrow function，this 需指向执行此方法的 pluginApi
        // 否则 pluginId 会不对，导致不能正确 skip plugin
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        function fn(fn: (...args: any[]) => void | Record<string, unknown>) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          this.register(name, isPlainObject(fn) ? fn.fn : fn)
        },
    }
  }

  /**
   * 注册预设
   * @param resolvedPresets 解析后的预设集合
   * @param prefix 插件包名前缀
   * @param presets 预设
   */
  public registerPresets(resolvedPresets: Plugin[], presets: unknown[]) {
    assert(
      this.pluggable.state === PluggableStateEnum.InitPresets,
      `api.registerPresets() failed, it should only used in presets state.`,
    )

    resolvedPresets.unshift(
      ...presets.map(
        preset =>
          new Plugin({
            path: preset as string,
            cwd: this.pluggable.cwd,
            type: PluginTypeEnum.Preset,
          }),
      ),
    )
  }

  /**
   * 注册插件
   * @param resolvedPlugins 解析后的插件集合
   * @param prefix 插件包名前缀
   * @param presets 预设
   */
  public registerPlugins(
    resolvedPlugins: Plugin[],
    plugins: (string | Plugin)[],
  ) {
    assert(
      this.pluggable.state === PluggableStateEnum.InitPresets ||
        this.pluggable.state === PluggableStateEnum.InitPlugins,
      `api.registerPlugins() failed, it should only be used in registering stage.`,
    )

    const mappedPlugins = plugins.map(plugin => {
      if (isString(plugin)) {
        return new Plugin({
          path: plugin,
          cwd: this.pluggable.cwd,
          type: PluginTypeEnum.Plugin,
        })
      } else {
        assert(
          plugin.id && plugin.key,
          `Invalid plugin object, id and key must supplied.`,
        )

        plugin.type = PluginTypeEnum.Plugin
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        plugin.apply = plugin.apply || (() => () => {})
        plugin.config = plugin.config || {}
        plugin.time = { hooks: {} }

        return plugin
      }
    })

    if (this.pluggable.state === PluggableStateEnum.InitPresets) {
      resolvedPlugins.push(...mappedPlugins)
    } else {
      resolvedPlugins.unshift(...mappedPlugins)
    }
  }

  /**
   * 跳过插件
   * @param keys 插件 key
   */
  public skipPlugins(keys: string[]) {
    keys.forEach(key => {
      const plugin = this.pluggable.key2Plugin[key]
      assert(!(this.plugin.key === key), `plugin ${key} can't skip itself.`)
      assert(
        plugin,
        `key: ${key} is not be registered by any plugin. You can't skip it.`,
      )
      this.pluggable.skippedPluginIds.add(plugin.id)
    })
  }
}
