// 劫持 require 逻辑，模版在 `require('@eljs/create')` 就可以拿到当前的 NPM 包
import './require-hook'
import type { GeneratePluginConfig } from './types'

export { Create } from './core/create'
export * from './types'

export function defineConfig(
  config: GeneratePluginConfig,
): GeneratePluginConfig {
  return config
}
