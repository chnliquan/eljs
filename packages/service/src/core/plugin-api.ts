import { isPlainObject, isString } from '@eljs/utils'
import assert from 'assert'
import { EnableBy, PluginType } from '../types'
import { Hook, HookOpts } from './hook'
import { Plugin } from './plugin'
import { Service } from './service'

export interface ProxyPluginAPIOpts {
  pluginAPI: PluginAPI
  service: Service
  serviceProps: string[]
  staticProps: Record<string, any>
}

export interface PluginAPIOpts {
  service: Service
  plugin: Plugin
}

export interface DescribeOpts {
  key?: string
  enableBy?: EnableBy | (() => boolean)
}

export class PluginAPI {
  public service: Service
  public plugin: Plugin

  public constructor(opts: PluginAPIOpts) {
    this.service = opts.service
    this.plugin = opts.plugin
  }

  public describe(opts: DescribeOpts) {
    this.plugin.merge(opts)
  }

  public register(opts: Omit<HookOpts, 'plugin'>) {
    this.service.hooks[opts.key] ||= []
    this.service.hooks[opts.key].push(
      new Hook({ ...opts, plugin: this.plugin }),
    )
  }

  public registerMethod(opts: { name: string; fn?: () => void }) {
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
        function fn(fn: () => void | Record<string, any>) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          this.register({
            key: opts.name,
            ...(isPlainObject(fn) ? fn : { fn }),
          })
        },
    }
  }

  public registerPresets(source: Plugin[], presets: any[]) {
    assert(
      this.service.stage === 'initPresets',
      `api.registerPresets() failed, it should only used in presets.`,
    )

    const plugins = presets.map(
      preset =>
        new Plugin({
          path: preset,
          cwd: this.service.cwd,
          type: PluginType.plugin,
        }),
    )

    source.splice(0, 0, ...plugins)
  }

  public registerPlugins(source: Plugin[], plugins: any[]) {
    assert(
      this.service.stage === 'initPresets' ||
        this.service.stage === 'initPlugins',
      `api.registerPlugins() failed, it should only be used in registering stage.`,
    )

    const mappedPlugins = plugins.map(plugin => {
      if (isString(plugin)) {
        return new Plugin({
          path: plugin,
          cwd: this.service.cwd,
          type: PluginType.plugin,
        })
      } else {
        assert(
          plugin.id && plugin.key,
          `Invalid plugin object, id and key must supplied.`,
        )

        plugin.type = PluginType.plugin
        plugin.enableBy = plugin.enableBy || EnableBy.register
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        plugin.apply = plugin.apply || (() => () => {})
        plugin.config = plugin.config || {}
        return plugin
      }
    })

    if (this.service.stage === 'initPresets') {
      source.push(...mappedPlugins)
    } else {
      source.splice(0, 0, ...mappedPlugins)
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
