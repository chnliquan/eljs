import type { PluggablePluginApi, PluginApi } from '@eljs/pluggable'

import type { RunnerPluginApi } from '../runner.js'

/**
 * 插件 Api 参数
 */
export type Api = Omit<PluginApi, 'registerPresets' | 'registerPlugins'> &
  PluggablePluginApi &
  RunnerPluginApi
