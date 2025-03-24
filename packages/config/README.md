# @eljs/config

Load your config file

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

Create config manager

```ts
export interface ConfigManagerOptions {
  /**
   * Working directory
   * @default process.cwd()
   */
  cwd?: string
  /**
   * Default config files
   * @example
   * config.ts、config.js、config.json
   */
  defaultConfigFiles: string[]
  /**
   * Default config extensions
   * @example
   * .dev => config.dev.ts
   * .prod => config.prod.ts
   */
  defaultConfigExts?: string[]
}
```

### `configManager.getConfig<T extends object>(): Promise<T | null>`

Asynchronously returns the object after the configuration files merged

### `configManager.getConfigSync<T extends object>(): Promise<T | null>`

Synchronously returns the object after the configuration files merged
