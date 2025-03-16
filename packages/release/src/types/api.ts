import type { Runner, RunnerPluginApi } from '@/runner'
import type { PluggablePluginApi, PluginApi } from '@eljs/pluggable'

import type { Config } from './config'

/**
 * 插件 Api 参数
 */
export type Api = PluginApi<Runner> &
  PluggablePluginApi &
  RunnerPluginApi & {
    /**
     * 用户配置项
     */
    userConfig: Config
  }
