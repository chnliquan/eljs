import type { Runner, RunnerPluginApi } from '@/runner'
import type { PluggablePluginApi, PluginApi } from '@eljs/pluggable'

/**
 * 插件 Api 参数
 */
export type Api = PluginApi<Runner> & PluggablePluginApi & RunnerPluginApi
