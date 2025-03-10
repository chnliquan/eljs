// 劫持 require 逻辑，模版在 `require('@eljs/create')` 就可以拿到当前的 NPM 包
import type { RunnerPluginConfig } from '@/core'
import './require-hook'
export { Create } from '@/core'
export * from './types'
/**
 * 定义插件配置项
 * @param config 插件配置项
 */
export function defineConfig(config: RunnerPluginConfig): RunnerPluginConfig {
  return config
}
