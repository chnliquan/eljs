# @eljs/config

Load your config file.

## Installation

```bash
$ pnpm add @eljs/config
// or
$ yarn add @eljs/config
// ro
$ npm i @eljs/config -S
```

## Usage

```ts
import { ConfigManager } from '@eljs/config'

const configManager = new ConfigManager({
  defaultConfigFiles: ['config.ts', 'config.js'],
})

configManager.getConfig()
```

## API

### `new ConfigManager(options: ConfigManagerOptions): ConfigManager`

Create a config manager instance.

```ts
export interface ConfigManagerOptions {
  /**
   * Default config files
   * @example
   * ['config.ts', 'config.js']
   */
  defaultConfigFiles: string[]
  /**
   * Default config file extensions
   * @example
   * ['dev', 'staging'] => ['config.dev.ts', 'config.staging.ts']
   */
  defaultConfigExts?: string[]
  /**
   * Working directory
   * @default process.cwd()
   */
  cwd?: string
}
```

### `configManager.getConfig<T extends object>(): Promise<T | null>`

Return the config object after the configuration files merged asynchronously.

### `configManager.getConfigSync<T extends object>(): Promise<T | null>`

Return the config object after the configuration files merged synchronously.
