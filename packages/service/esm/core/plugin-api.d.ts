import { type DistributiveOmit } from '@eljs/utils'
import { EnableBy } from '../enum'
import { type Generator } from '../types'
import { type CommandOpts } from './command'
import { type HookOpts } from './hook'
import { Plugin } from './plugin'
import { Service } from './service'
declare const resolveConfigModes: readonly ['strict', 'loose']
export type ResolveConfigMode = typeof resolveConfigModes[number]
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
export declare class PluginAPI<T extends Service = Service> {
  service: T
  plugin: Plugin
  constructor(opts: PluginAPIOpts)
  describe(opts: { key?: string; enableBy?: EnableBy | (() => boolean) }): void
  registerCommand(
    opts: Omit<CommandOpts, 'plugin'> & {
      alias?: string | string[]
    },
  ): void
  registerGenerator(opts: DistributiveOmit<Generator, 'plugin'>): void
  register(opts: Omit<HookOpts, 'plugin'>): void
  registerMethod(opts: { name: string; fn?: (...args: any[]) => void }): void
  registerPresets(source: Plugin[], prefix: string, presets: unknown[]): void
  registerPlugins<T extends string | Plugin>(
    source: Plugin[],
    prefix: string,
    plugins: T[],
  ): void
  skipPlugins(keys: string[]): void
  static proxyPluginAPI(opts: ProxyPluginAPIOpts): PluginAPI<Service>
}
export {}
//# sourceMappingURL=plugin-api.d.ts.map
