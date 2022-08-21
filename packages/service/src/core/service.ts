import utils, { isPromise } from '@eljs/utils'
import assert from 'assert'
import { existsSync } from 'fs'
import { AsyncSeriesWaterfallHook } from 'tapable'
import { ApplyEvent, ApplyPluginsType, EnableBy, PluginType } from '../types'
import { Hook } from './hook'
import { Plugin } from './plugin'
import { PluginAPI } from './plugin-api'

export interface ServiceOpts {
  /**
   * 当前执行路径
   */
  cwd: Service['cwd']
  /**
   * 预设集合
   */
  presets?: string[]
  /**
   * 插件集合
   */
  plugins?: Service['plugins']
}

export class Service {
  /**
   * 执行阶段
   */
  public stage = 'uninitialized'
  /**
   * 构造函数配置项
   */
  public opts: ServiceOpts
  /**
   * 当前执行路径
   */
  public cwd: string
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

  public constructor(opts: ServiceOpts) {
    this.opts = opts
    this.cwd = opts.cwd

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
    )
    pluginAPI.registerPlugins = pluginAPI.registerPlugins.bind(
      pluginAPI,
      opts.plugins,
    )

    const proxyPluginAPI = PluginAPI.proxyPluginAPI({
      service: this,
      pluginAPI,
      ...this.getProxyProps(),
    })

    const res: {
      plugins: Plugin[]
      presets: Plugin[]
    } = Object.create(null)

    let pluginRes = opts.plugin.apply()(proxyPluginAPI)

    if (isPromise(pluginRes)) {
      pluginRes = await pluginRes
    }

    if (opts.plugin.type === 'plugin') {
      assert(!pluginRes, `plugin should return nothing.`)
    }

    // key should be unique
    assert(
      !this.keyToPluginMap[opts.plugin.key],
      `key ${opts.plugin.key} is already registered by ${
        this.keyToPluginMap[opts.plugin.key]?.path
      }, ${opts.plugin.type} from ${opts.plugin.path} register failed.`,
    )

    this.keyToPluginMap[opts.plugin.key] = opts.plugin

    if (pluginRes?.presets) {
      res.presets = pluginRes.presets.map(
        (preset: string) =>
          new Plugin({
            path: preset,
            type: PluginType.preset,
            cwd: this.cwd,
          }),
      )
    }

    if (pluginRes?.plugins) {
      res.plugins = pluginRes.plugins.map(
        plugin =>
          new Plugin({
            path: plugin,
            type: PluginType.plugin,
            cwd: this.cwd,
          }),
      )
    }

    return res
  }

  protected getProxyProps(opts?: {
    serviceProps: string[]
    staticProps: Record<string, any>
  }) {
    const { serviceProps = [], staticProps = Object.create(null) } = opts || {}
    return {
      serviceProps: ['cwd', 'applyPlugins', 'isPluginEnable', ...serviceProps],
      staticProps: {
        ApplyPluginsType,
        EnableBy,
        PluginType,
        service: this,
        utils,
        ...staticProps,
      },
    } as { serviceProps: string[]; staticProps: Record<string, any> }
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
        type = ApplyPluginsType.event
      } else if (opts.key.startsWith('modify')) {
        type = ApplyPluginsType.modify
      } else if (opts.key.startsWith('add')) {
        type = ApplyPluginsType.add
      } else {
        throw new Error(
          `Invalid applyPlugins arguments, type must be supplied for key ${opts.key}.`,
        )
      }
    }

    const hooks = this.hooks[opts.key] || []

    switch (type) {
      case ApplyPluginsType.add:
        assert(
          !('initialValue' in opts) || Array.isArray(opts.initialValue),
          `applyPlugins failed, opts.initialValue must be Array if opts.type is add.`,
        )

        // eslint-disable-next-line no-case-declarations
        const tAdd = new AsyncSeriesWaterfallHook(['memo'])

        for (const hook of hooks) {
          if (!this.isPluginEnable(hook)) continue
          tAdd.tapPromise(
            {
              name: hook.plugin.key,
              stage: hook.stage,
              before: hook.before,
            },
            async memo => {
              const items = await hook.fn(opts.args)
              return (memo as []).concat(items)
            },
          )
        }
        return tAdd.promise(opts.initialValue || [])

      case ApplyPluginsType.modify:
        // eslint-disable-next-line no-case-declarations
        const tModify = new AsyncSeriesWaterfallHook(['memo'])

        for (const hook of hooks) {
          if (!this.isPluginEnable(hook)) continue
          tModify.tapPromise(
            {
              name: hook.plugin.key,
              stage: hook.stage,
              before: hook.before,
            },
            async memo => await hook.fn(memo, opts.args),
          )
        }
        return tModify.promise(opts.initialValue)

      case ApplyPluginsType.event:
        // eslint-disable-next-line no-case-declarations
        const tEvent = new AsyncSeriesWaterfallHook(['_'])

        for (const hook of hooks) {
          if (!this.isPluginEnable(hook)) continue
          tEvent.tapPromise(
            {
              name: hook.plugin.key,
              stage: hook.stage || 0,
              before: hook.before,
            },
            async () => await hook.fn(opts.args),
          )
        }
        return tEvent.promise(1)

      default:
        throw new Error(
          `applyPlugins failed, type is not defined or is not matched, got ${opts.type}.`,
        )
    }
  }

  public async getPresetsAndPlugins() {
    this.stage = 'init'

    const { plugins, presets } = Plugin.getPluginsAndPresets({
      cwd: this.cwd,
      presets: this.opts.presets || [],
      plugins: (this.opts.plugins || []) as string[],
    })

    // 注册预设
    this.stage = 'initPresets'

    const presetPlugins: Plugin[] = []
    while (presets.length) {
      await this.initPreset({
        preset: presets.shift() as Plugin,
        presets,
        plugins: presetPlugins,
      })
    }

    plugins.unshift(...presetPlugins)

    // 注册插件
    this.stage = 'initPlugins'
    while (plugins.length) {
      await this.initPlugin({ plugin: plugins.shift() as Plugin, plugins })
    }

    return { presets, plugins }
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

    // EnableBy.register
    return true
  }
}

export interface ServicePluginAPI {
  /**
   * 当前执行路径
   */
  cwd: typeof Service.prototype.cwd
  /**
   * 工具函数
   */
  utils: typeof utils
  /**
   * 执行插件
   */
  applyPlugins: typeof Service.prototype.applyPlugins
  /**
   * 插件是否可用
   */
  isPluginEnable: typeof Service.prototype.isPluginEnable
  /**
   * 应用检查事件
   */
  onCheck: ApplyEvent<null>
  /**
   * 应用启动事件
   */
  onStart: ApplyEvent<null>
  /**
   * 注册预设
   */
  registerPresets: (presets: string[]) => void
  /**
   * 注册插件预设
   */
  registerPlugins: (plugins: (Plugin | Record<string, any>)[]) => void

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
}
