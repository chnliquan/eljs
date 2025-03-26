import type { RunnerPluginApi } from '@/runner'
import type { PluggablePluginApi, PluginApi } from '@eljs/pluggable'

/**
 * 插件 Api 参数
 */
export type Api = Omit<PluginApi, 'registerPresets' | 'registerPlugins'> &
  PluggablePluginApi &
  RunnerPluginApi
