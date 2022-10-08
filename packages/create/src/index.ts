import './require-hook'
import { GeneratePluginConfig } from './types'

export { Create } from './core/create'
export * from './types'

export function defineConfig(
  config: GeneratePluginConfig,
): GeneratePluginConfig {
  return config
}
