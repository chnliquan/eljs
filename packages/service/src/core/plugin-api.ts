import { isPlainObject, isString } from '@eljs/utils'
import assert from 'assert'
import { EnableBy, PluginType, ServiceStage } from '../types'
import { Hook, HookOpts } from './hook'
import { Plugin } from './plugin'
import { Service } from './service'

export interface ProxyPluginAPIOpts<T = Service> {
  pluginAPI: PluginAPI
  service: T
  serviceProps: string[]
  staticProps: Record<string, unknown>
}

export interface PluginAPIOpts<T = Service> {
  service: T
  plugin: Plugin
}

export class PluginAPI<T extends Service = Service> {
  public service: T
  public plugin: Plugin

  public constructor(opts: PluginAPIOpts) {
    this.service = opts.service as T
    this.plugin = opts.plugin
  }

  public describe(opts: {
    key?: string
    enableBy?: EnableBy | (() => boolean)
  }) {
    this.plugin.merge(opts)
  }

  public register(opts: Omit<HookOpts, 'plugin'>) {
    this.service.hooks[opts.key] ||= []
    this.service.hooks[opts.key].push(
      new Hook({ ...opts, plugin: this.plugin }),
    )
  }

  public registerMethod(opts: { name: string; fn?: (...args: any[]) => void }) {
    assert(
      !this.service.pluginMethods[opts.name],
      `api.registerMethod() failed, method ${opts.name} is already exist.`,
    )

    this.service.pluginMethods[opts.name] = {
      plugin: this.plugin,
      fn:
        opts.fn ||
        // 这里不能用 arrow function，this 需指向执行此方法的 PluginAPI
        // 否则 pluginId 会不对，导致不能正确 skip plugin
        function fn(fn: (...args: any[]) => void | Record<string, unknown>) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          this.register({
            key: opts.name,
            ...(isPlainObject(fn) ? fn : { fn }),
          })
        },
    }
  }

  public registerPresets(source: Plugin[], presets: unknown[]) {
    assert(
      this.service.stage === ServiceStage.InitPresets,
      `api.registerPresets() failed, it should only used in presets stage.`,
    )

    const plugins = presets.map(
      preset =>
        new Plugin({
          path: preset as string,
          cwd: this.service.cwd,
          type: PluginType.Plugin,
        }),
    )

    source.unshift(...plugins)
  }

  public registerPlugins<T extends string | Plugin>(
    source: Plugin[],
    plugins: T[],
  ) {
    assert(
      this.service.stage === ServiceStage.InitPresets ||
        this.service.stage === ServiceStage.InitPlugins,
      `api.registerPlugins() failed, it should only be used in registering stage.`,
    )

    const mappedPlugins = plugins.map(plugin => {
      if (isString(plugin)) {
        return new Plugin({
          path: plugin,
          cwd: this.service.cwd,
          type: PluginType.Plugin,
        })
      } else {
        assert(
          plugin.id && plugin.key,
          `Invalid plugin object, id and key must supplied.`,
        )

        plugin.type = PluginType.Plugin
        plugin.enableBy = plugin.enableBy || EnableBy.Register
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        plugin.apply = plugin.apply || (() => () => {})

        return plugin as Plugin
      }
    })

    if (this.service.stage === ServiceStage.InitPresets) {
      source.push(...mappedPlugins)
    } else {
      source.unshift(...mappedPlugins)
    }
  }

  public skipPlugins(keys: string[]) {
    keys.forEach(key => {
      assert(!(this.plugin.key === key), `plugin ${key} can't skip itself!`)
      assert(
        this.service.keyToPluginMap[key],
        `key: ${key} is not be registered by any plugin. You can't skip it!`,
      )
      this.service.skipPluginIds.add(this.service.keyToPluginMap[key].id)
    })
  }

  public static proxyPluginAPI(opts: ProxyPluginAPIOpts) {
    return new Proxy(opts.pluginAPI, {
      get: (target, prop: string) => {
        if (opts.service.pluginMethods[prop]) {
          return opts.service.pluginMethods[prop].fn
        }

        if (opts.serviceProps.includes(prop)) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const serviceProp = opts.service[prop]
          return typeof serviceProp === 'function'
            ? serviceProp.bind(opts.service)
            : serviceProp
        }

        if (prop in opts.staticProps) {
          return opts.staticProps[prop]
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return target[prop]
      },
    })
  }
}
