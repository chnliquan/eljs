# @eljs/pluggable

A powerful, type-safe plugin system with zero-configuration setup and flexible extensibility.

[![NPM Version](https://img.shields.io/npm/v/@eljs/pluggable.svg)](https://www.npmjs.com/package/@eljs/pluggable)
[![NPM Downloads](https://img.shields.io/npm/dm/@eljs/pluggable.svg)](https://www.npmjs.com/package/@eljs/pluggable)
[![License](https://img.shields.io/npm/l/@eljs/pluggable.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## ✨ Features

- 🔧 **Flexible Architecture** - Support for plugins and presets with nested registration
- 🔒 **Type Safety** - Full TypeScript support with comprehensive type definitions
- 📊 **Performance Monitoring** - Built-in execution time tracking and statistics
- 🎯 **Hook System** - Multiple hook types: Add, Modify, Get, and Event
- 🛡️ **Robust** - Intelligent plugin resolution and error handling
- 🔌 **Extensible** - Easy to extend with custom APIs and methods

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @eljs/pluggable

# Using yarn
yarn add @eljs/pluggable

# Using npm
npm install @eljs/pluggable -S
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { Pluggable } from '@eljs/pluggable'

// Create a pluggable runner
export class Runner extends Pluggable {
  public constructor(options: PluggableOptions) {
    super(options)
  }

  public async run() {
    // Load presets and plugins from config
    await this.load()

    // Apply plugins with hooks
    await this.applyPlugins('onStart')
    await this.applyPlugins('onBuild', {
      type: ApplyPluginTypeEnum.Event,
    })

    const result = await this.applyPlugins('modifyConfig', {
      type: ApplyPluginTypeEnum.Modify,
      initialValue: {
        /* initial config */
      },
    })
  }
}

// Initialize and run
const runner = new Runner({
  cwd: process.cwd(),
  presets: ['preset-react'],
  plugins: [
    'plugin-typescript',
    ['plugin-babel', { presets: ['@babel/preset-env'] }],
  ],
})

await runner.run()
```

### Type-Safe Plugin Development

```typescript
// Define your plugin with TypeScript
interface MyPluginOptions {
  outputDir: string
  minify: boolean
}

// Plugin implementation
export default function myPlugin(api: PluginApi, options: MyPluginOptions) {
  // Describe plugin metadata
  api.describe({
    key: 'my-custom-plugin',
    enable: () => options.minify !== false,
  })

  // Register hooks
  api.register('onStart', async () => {
    console.log('Build started!')
  })

  api.register('modifyConfig', async (initialConfig, { isDev }) => {
    return {
      ...initialConfig,
      outputPath: options.outputDir,
      optimization: {
        minimize: options.minify,
      },
    }
  })

  // Register custom methods
  api.registerMethod('customBuild', async buildOptions => {
    // Custom build logic
  })
}
```

## 📖 API Reference

### Pluggable Constructor

```typescript
new Pluggable<T>(options: PluggableOptions)

interface PluggableOptions {
  /**
   * Working directory
   * @default process.cwd()
   */
  cwd: string
  /**
   * Preset declarations
   */
  presets?: PluginDeclaration[]
  /**
   * Plugin declarations
   */
  plugins?: PluginDeclaration[]
  /**
   * Default config files
   * @example
   * ['config.ts', 'config.js']
   */
  defaultConfigFiles?: string[]
  /**
   * Default config file extensions
   * @example
   * ['dev', 'staging'] => ['config.dev.ts', 'config.staging.ts']
   */
  defaultConfigExts?: string[]
}

type PluginDeclaration<Options = Record<string, any>> =
  | string
  | string[]
  | [string, Options]
```

### Core Methods

#### `load()` - Load Presets and Plugins

```typescript
protected async load(): Promise<void>
```

Loads and initializes all presets and plugins based on configuration files and constructor options.

**Features:**

- Automatic config file discovery and parsing
- Nested preset resolution
- Plugin dependency management
- Error handling with detailed messages

#### `applyPlugins()` - Execute Plugin Hooks

```typescript
async applyPlugins<T, U>(
  key: string,
  options?: ApplyPluginsOptions<T, U>
): Promise<T>

interface ApplyPluginsOptions<T, U> {
  /** Hook execution type */
  type?: ApplyPluginTypeEnum
  /** Initial value for modify/add hooks */
  initialValue?: T
  /** Arguments passed to hook functions */
  args?: U
}

enum ApplyPluginTypeEnum {
  Add = 'add',       // Accumulate values into array
  Modify = 'modify', // Transform initial value
  Get = 'get',       // Return first non-null result
  Event = 'event',   // Execute side effects
}
```

**Hook Types Explained:**

```typescript
// Add Hook - Accumulate results into an array
const items = await this.applyPlugins('addItems', {
  type: ApplyPluginTypeEnum.Add,
  initialValue: [],
  args: { context: 'build' },
})
// Result: [...item1, ...item2, ...item3]

// Modify Hook - Transform value through chain
const config = await this.applyPlugins('modifyConfig', {
  type: ApplyPluginTypeEnum.Modify,
  initialValue: baseConfig,
  args: { env: 'production' },
})
// Result: transformed config object

// Get Hook - Return first non-null result
const result = await this.applyPlugins('getResult', {
  type: ApplyPluginTypeEnum.Get,
  args: { query: 'something' },
})
// Result: first plugin's non-null return value

// Event Hook - Execute side effects
await this.applyPlugins('onComplete', {
  type: ApplyPluginTypeEnum.Event,
  args: { stats: buildStats },
})
// Result: void (all plugins executed)
```

### Plugin API

#### `PluginApi` - Plugin Development Interface

```typescript
interface PluginApi {
  /** Describe plugin metadata */
  describe(options: { key?: string; enable?: Enable }): void

  /** Register hook function */
  register(
    key: string,
    fn: (...args: any[]) => MaybePromise<any>,
    options?: { before?: string; stage?: number },
  ): void

  /** Register custom method */
  registerMethod(name: string, fn?: Function): void

  /** Skip other plugins */
  skipPlugins(keys: string[]): void

  /** Register additional presets */
  registerPresets(presets: PluginDeclaration[]): void

  /** Register additional plugins */
  registerPlugins(plugins: PluginDeclaration[]): void
}

type Enable = boolean | (() => boolean)
```

## 🎯 Hook System

### Hook Execution Order

Hooks support execution order control through `stage` and `before` options:

```typescript
// Plugin A
api.register('modifyConfig', configA, { stage: -100 }) // Runs first

// Plugin B
api.register('modifyConfig', configB, { before: 'plugin-c' }) // Runs before plugin-c

// Plugin C
api.register('modifyConfig', configC) // Default stage (0)

// Plugin D
api.register('modifyConfig', configD, { stage: 100 }) // Runs last
```

### Hook Types in Detail

#### Add Hook

```typescript
// Register add hook
api.register('addEntries', async ({ isDev }) => {
  return isDev ? ['dev-entry.js'] : ['prod-entry.js']
})

// Apply add hook
const entries = await this.applyPlugins('addEntries', {
  type: ApplyPluginTypeEnum.Add,
  initialValue: ['main.js'],
  args: { isDev: process.env.NODE_ENV === 'development' },
})
// Result: ['main.js', 'dev-entry.js'] or ['main.js', 'prod-entry.js']
```

#### Modify Hook

```typescript
// Register modify hook
api.register('modifyWebpackConfig', async (config, { target }) => {
  if (target === 'node') {
    config.target = 'node'
    config.externals = nodeExternals()
  }
  return config
})

// Apply modify hook
const webpackConfig = await this.applyPlugins('modifyWebpackConfig', {
  type: ApplyPluginTypeEnum.Modify,
  initialValue: baseConfig,
  args: { target: 'browser' },
})
```

## 🧩 Plugin Development Guide

### Creating a Plugin

```typescript
// my-awesome-plugin.ts
import type { PluginApi } from '@eljs/pluggable'

export interface MyPluginOptions {
  outputDir?: string
  minify?: boolean
  target?: 'browser' | 'node'
}

export default function myAwesomePlugin(
  api: PluginApi,
  options: MyPluginOptions = {},
) {
  const { outputDir = 'dist', minify = true, target = 'browser' } = options

  // Describe plugin
  api.describe({
    key: 'my-awesome-plugin',
    enable: () => true, // Always enabled
  })

  // Add configuration entries
  api.register('addEntries', () => {
    return target === 'node' ? ['src/server.js'] : []
  })

  // Modify build configuration
  api.register(
    'modifyConfig',
    (config, { isDev }) => {
      return {
        ...config,
        output: outputDir,
        minification: minify && !isDev,
        target,
      }
    },
    { stage: -50 },
  ) // Run early

  // Add build event listeners
  api.register('onBuildStart', async () => {
    console.log('🚀 Starting build process...')
  })

  api.register('onBuildComplete', async ({ stats }) => {
    console.log(`✨ Build completed in ${stats.duration}ms`)
  })

  // Register custom method
  api.registerMethod('customOptimize', async options => {
    // Custom optimization logic
    return { optimized: true, ...options }
  })
}

// Export type for users
export type MyAwesomePlugin = typeof myAwesomePlugin
```

### Using the Plugin

```typescript
// Configuration
const runner = new BuildTool({
  cwd: process.cwd(),
  plugins: [
    // Basic usage
    'my-awesome-plugin',

    // With options
    [
      'my-awesome-plugin',
      {
        outputDir: 'build',
        minify: false,
        target: 'node',
      },
    ],
  ],
})
```
