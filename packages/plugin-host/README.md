# @eljs/plugin-host

A type-safe plugin host for Node.js tools with presets, ordered hooks, and extensible plugin contexts.

[![NPM Version](https://img.shields.io/npm/v/@eljs/plugin-host.svg)](https://www.npmjs.com/package/@eljs/plugin-host)
[![NPM Downloads](https://img.shields.io/npm/dm/@eljs/plugin-host.svg)](https://www.npmjs.com/package/@eljs/plugin-host)
[![License](https://img.shields.io/npm/l/@eljs/plugin-host.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## ✨ Features

- 🔧 **Flexible Architecture** - Support for plugins and presets with nested registration
- 🔒 **Type Safety** - Hook Schema drives runtime behavior and TypeScript contracts
- 📊 **Debug Diagnostics** - Bounded hook timing samples and failure counts
- 🎯 **Hook System** - Multiple hook types: Add, Modify, Get, and Event
- 🛡️ **Guarded Lifecycle** - Single-load state validation and failed-load cleanup
- 🔌 **Extensible** - Easy to extend with custom APIs and methods

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @eljs/plugin-host

# Using yarn
yarn add @eljs/plugin-host

# Using npm
npm install @eljs/plugin-host -S
```

## 🚀 Quick Start

### Basic Usage

```ts
import {
  PluginHost,
  defineEventHook,
  defineHooks,
  defineModifyHook,
  type PluginHostOptions,
  type UserConfig,
} from '@eljs/plugin-host'

export const runnerHooks = defineHooks({
  onStart: defineEventHook(),
  onBuild: defineEventHook(),
  modifyConfig: defineModifyHook<Record<string, unknown>>(),
})

// Create a plugin-powered runner
export class Runner extends PluginHost<UserConfig, typeof runnerHooks> {
  public constructor(options: PluginHostOptions) {
    super(options, runnerHooks)
  }

  public async run() {
    // Load presets and plugins from config
    await this.load()

    // Run hooks
    await this.runHook('onStart')
    await this.runHook('onBuild')

    const result = await this.runHook('modifyConfig', {
      initialValue: {/* initial config */},
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

```ts
import { definePlugin, type PluginContext } from '@eljs/plugin-host'
import { runnerHooks } from './runner'

type MyPluginContext = PluginContext<typeof runnerHooks>

// Define your plugin with TypeScript
interface MyPluginOptions {
  outputDir: string
  minify: boolean
}

// Plugin implementation
export default definePlugin<MyPluginOptions, MyPluginContext>(
  (
    context,
    options = {
      outputDir: 'dist',
      minify: true,
    },
  ) => {
    // Describe plugin metadata
    context.describe({
      key: 'my-custom-plugin',
      enable: () => options.minify !== false,
    })

    // Register hooks
    context.onStart(async () => {
      console.log('Build started!')
    })

    context.modifyConfig(async initialConfig => {
      return {
        ...initialConfig,
        outputPath: options.outputDir,
        optimization: {
          minimize: options.minify,
        },
      }
    })

    // Register a custom capability
    context.registerCapability('customBuild', async buildOptions => {
      // Custom build logic
    })
  },
)
```

`definePlugin()` and `definePreset()` are identity helpers: they add contextual typing without
wrapping runtime behavior when called with a function. Plugins that need runtime option validation
can use the object form with any Standard Schema-compatible validator. Zod is the recommended
implementation for eljs plugins:

```bash
pnpm add zod
```

```ts
import { definePlugin } from '@eljs/plugin-host'
import { z } from 'zod'

export default definePlugin({
  optionsSchema: z.object({
    outputDir: z.string().default('dist'),
    minify: z.boolean().default(true),
  }),
  initialize(context: MyPluginContext, options) {
    // `options` contains the parsed output, including defaults and transforms.
    context.onStart(() => {
      console.log(`Building into ${options.outputDir}`)
    })
  },
})
```

The Schema validates the second item of a plugin declaration before initialization. Its input type
describes user configuration, while its output type describes the initializer's `options`
parameter. A Schema must accept `undefined` when the declaration may omit options. Valibot, ArkType,
Yup, and other Standard Schema-compatible validators can be used without adapters. Use the singular
`definePreset()` because each call defines one preset, even when that preset returns multiple nested
declarations.

```ts
import { definePreset } from '@eljs/plugin-host'

export default definePreset(() => ({
  presets: ['preset-base'],
  plugins: [
    'plugin-typescript',
    [
      'plugin-babel',
      {
        presets: ['@babel/preset-env'],
      },
    ],
  ],
}))
```

### Extending Plugin Context (Advanced)

If you are building a complex framework on top of `@eljs/plugin-host`, you might want to inject
custom properties or utilities directly into the plugin context so that all plugins can access them
seamlessly.

You can achieve this by overriding `getPluginContextExtensions()` in your runner class.

```ts
import {
  PluginHost,
  type Plugin,
  type PluginContext,
  type UserConfig,
} from '@eljs/plugin-host'
import { runnerHooks } from './runner'

interface CustomCapabilities {
  logger(message: string): void
  frameworkVersion: string
}

export class CustomRunner extends PluginHost<
  UserConfig,
  typeof runnerHooks,
  CustomCapabilities
> {
  protected getPluginContextExtensions(plugin: Plugin): CustomCapabilities {
    return {
      // Plugins can call: context.logger('msg')
      logger: (msg: string) => {
        console.log(`[Plugin: ${plugin.id}] ${msg}`)
      },

      // Plugins can access: context.frameworkVersion
      frameworkVersion: '1.0.0',

      // Extension names must not conflict with PluginApi or Hook Schema names.
    }
  }
}

// Inside a plugin:
export default function plugin(
  context: PluginContext<typeof runnerHooks, CustomCapabilities>,
) {
  context.logger('Hello from custom API!')
}
```

Runner properties and methods are not exposed automatically. Plugins can access only core
`PluginApi` methods, Hook Schema registration methods, explicit extensions, and capabilities added
with `registerCapability()`.

## 📖 API Reference

### Extending `PluginHost`

```ts
abstract class PluginHost<Config, Schema, Extensions> {
  constructor(options: PluginHostOptions, hookSchema?: Schema)
}

interface PluginHostOptions {
  /**
   * Working directory
   */
  cwd: string
  /**
   * Stop plugin loading and hook execution at lifecycle boundaries
   */
  signal?: AbortSignal
  /**
   * Preset declarations
   */
  presets?: readonly PluginDeclaration[]
  /**
   * Plugin declarations
   */
  plugins?: readonly PluginDeclaration[]
  /**
   * Default config files
   * @example
   * ['config.ts', 'config.js']
   */
  defaultConfigFiles?: readonly string[]
  /**
   * Default config file extensions
   * @example
   * ['dev', 'staging'] => ['config.dev.ts', 'config.staging.ts']
   */
  defaultConfigExts?: readonly string[]
}

type PluginDeclaration<Options = Record<string, unknown>> =
  string | readonly [string, Options]
```

An aborted signal produces `PluginHostErrorCode.OperationAborted`. The host
checks cancellation before and after plugin initializers and individual hooks,
so an in-flight callback is allowed to settle but no later callback starts.

### Hook Schema

Hook Schema is the single source of truth for runtime Hook types and plugin registration methods.

```ts
const hooks = defineHooks({
  addEntries: defineAddHook<{ isDev: boolean }, string[]>(),
  modifyConfig: defineModifyHook<Config, { env: string }>(),
  getResult: defineGetHook<{ query: string }, Result>(),
  onComplete: defineEventHook<{ stats: BuildStats }>(),
})
```

`runHook()` accepts only keys from the Schema and derives its options and return value.
`HookRegistrationApi<typeof hooks>` derives the matching plugin-side methods.

### Core Methods

#### `load()` - Load Presets and Plugins

```ts
protected async load(): Promise<void>
```

Loads and initializes all presets and plugins based on configuration files and constructor options.
Each instance can load exactly once. Successful loading moves it into `ready`; a failed load moves it into the terminal `failed`
state and clears partial registrations.

**Features:**

- Automatic config file discovery and parsing
- Nested preset resolution
- Nested preset/plugin registration and duplicate detection
- Error handling with detailed messages

#### `runHook()` - Execute Plugin Hooks

```ts
async runHook<Key extends keyof Schema & string>(
  key: Key,
  ...args: HookRunArguments<Schema[Key]>
): Promise<HookRunResult<Schema[Key]>>
```

The Schema determines whether options are optional, whether `initialValue` is required, the `args`
shape, and the result type. `LooseHookRunOptions` and explicit runtime `kind` remain available only
for schema-less compatibility.

**Hook Types Explained:**

```ts
// Add Hook - Accumulate results into an array
const items = await this.runHook('addItems', {
  initialValue: [],
  args: { mode: 'build' },
})
// Result: [...item1, ...item2, ...item3]

// Modify Hook - Transform value through chain
const config = await this.runHook('modifyConfig', {
  initialValue: baseConfig,
  args: { env: 'production' },
})
// Result: transformed config object

// Get Hook - Return first non-nullish result
const result = await this.runHook('getResult', {
  args: { query: 'something' },
})
// Result: first plugin's non-nullish return value

// Event Hook - Execute side effects
await this.runHook('onComplete', {
  args: { stats: buildStats },
})
// Result: undefined (all plugins executed)
```

### `getPluginContextExtensions()` - Provide Context Extensions

```ts
protected getPluginContextExtensions(plugin: Plugin): Extensions
```

Returns the non-conflicting properties and methods merged into the `PluginContext` exposed to the
current plugin. It must return a plain object containing only own enumerable string properties.
Data-property functions retain stable references and are called with the extension object as
`this`; getters are evaluated on every access. Runner members not returned here remain private.

### Plugin Context and Core API

`PluginContext<Schema, Extensions>` is the complete object received by a plugin initializer. It
combines the core `PluginApi`, Hook Schema registration methods, and host-provided extensions.

#### `PluginApi` - Plugin Development Interface

```typescript
class PluginApi {
  /** Describe plugin metadata */
  describe(options: { key?: string; enable?: PluginHookEnablement }): void

  /** Register hook function */
  register(
    key: string,
    fn: (...args: unknown[]) => MaybePromise<unknown>,
    options?: { before?: string; stage?: number },
  ): void

  /** Register a custom capability */
  registerCapability(name: string, fn: Function): void

  /** Declare plugin keys whose hooks should be skipped */
  disablePluginHooks(keys: string[]): void

  /** Register additional presets */
  registerPresets(presets: PluginDeclaration[]): void

  /** Register additional plugins */
  registerPlugins(plugins: PluginDeclaration[]): void
}

type PluginHookEnablement = boolean | (() => boolean)
```

`enable` and `disablePluginHooks()` control hook execution only. They do not prevent plugin
initialization or undo capabilities and side effects registered during initialization. To avoid loading a
plugin entirely, remove it from the `plugins` or `presets` declaration. Skip declarations are
resolved after registration, so they do not depend on plugin order.

When a Hook Schema is supplied, `register()` also rejects keys that are not declared in the Schema.
Schema-generated methods such as `context.modifyConfig()` are the preferred registration interface.

### Errors

Plugin host domain errors use `PluginHostError` with a stable `code`, `cause`, and structured `details`.
Nested preset/plugin initialization errors include their declaration source and parent plugin.

### Plugin module formats

Plugin entry files support `.js`, `.cjs`, `.mjs`, `.ts`, and `.cts`. `.jsx`, `.tsx`, `.mts`, and
exports-only packages are not part of the supported contract. TypeScript plugin loading requires
TypeScript to be available in the consuming project.

### Trust model

Plugins and JavaScript/TypeScript configuration files execute in the current Node.js process with
the current process permissions. Only load trusted plugins and configuration.

## 🎯 Hook System

### Hook Execution Order

Hooks support execution order control through `stage` and `before` options:

```typescript
// Plugin A
context.modifyConfig(configA, { stage: -100 }) // Runs first

// Plugin B
context.modifyConfig(configB, { before: 'plugin-c' }) // Runs before plugin-c

// Plugin C
context.modifyConfig(configC) // Default stage (0)

// Plugin D
context.modifyConfig(configD, { stage: 100 }) // Runs last
```

### Hook Types in Detail

#### Add Hook

```typescript
// Register add hook
context.addEntries(async ({ isDev }) => {
  return isDev ? ['dev-entry.js'] : ['prod-entry.js']
})

// Apply add hook
const entries = await this.runHook('addEntries', {
  initialValue: ['main.js'],
  args: { isDev: process.env.NODE_ENV === 'development' },
})
// Result: ['main.js', 'dev-entry.js'] or ['main.js', 'prod-entry.js']
```

#### Modify Hook

```typescript
// Register modify hook
context.modifyWebpackConfig(async (config, { target }) => {
  if (target === 'node') {
    config.target = 'node'
    config.externals = nodeExternals()
  }
  return config
})

// Apply modify hook
const webpackConfig = await this.runHook('modifyWebpackConfig', {
  initialValue: baseConfig,
  args: { target: 'browser' },
})
```

## 🧩 Plugin Development Guide

### Creating a Plugin

```typescript
// my-awesome-plugin.ts
import { definePlugin } from '@eljs/plugin-host'

export interface MyPluginOptions {
  outputDir?: string
  minify?: boolean
  target?: 'browser' | 'node'
}

export default definePlugin<MyPluginOptions>((context, options = {}) => {
  const { outputDir = 'dist', minify = true, target = 'browser' } = options

  // Describe plugin
  context.describe({
    key: 'my-awesome-plugin',
    enable: () => true, // Always enabled
  })

  // Add configuration entries
  context.register('addEntries', () => {
    return target === 'node' ? ['src/server.js'] : []
  })

  // Modify build configuration
  context.register(
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
  context.register('onBuildStart', async () => {
    console.log('🚀 Starting build process...')
  })

  context.register('onBuildComplete', async ({ stats }) => {
    console.log(`✨ Build completed in ${stats.duration}ms`)
  })

  // Register custom method
  context.registerCapability('customOptimize', async options => {
    // Custom optimization logic
    return { optimized: true, ...options }
  })
})

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
