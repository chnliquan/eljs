import { GenerateConfig } from './types'

export { Create } from './core/create'
export * from './types'

export function defineConfig(config: GenerateConfig): GenerateConfig {
  return config
}
