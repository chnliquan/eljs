# @eljs/plugin-host

[English](./README.md)

面向 Node.js 工具的类型安全插件宿主，支持预设、有序钩子和可扩展的插件上下文。

[![NPM 版本](https://img.shields.io/npm/v/@eljs/plugin-host.svg)](https://www.npmjs.com/package/@eljs/plugin-host)
[![NPM 下载量](https://img.shields.io/npm/dm/@eljs/plugin-host.svg)](https://www.npmjs.com/package/@eljs/plugin-host)
[![许可证](https://img.shields.io/npm/l/@eljs/plugin-host.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## ✨ 特性

- 🔧 **灵活架构** - 支持插件和预设的嵌套注册
- 🔒 **类型安全** - Hook Schema 驱动运行时行为和 TypeScript 契约
- 🎯 **钩子系统** - 支持 Add、Modify、Get 和 Event 多种钩子类型
- 🛡️ **生命周期保护** - 单次加载状态校验和加载失败后的清理
- 🔌 **可扩展性** - 便于扩展自定义 API 和方法

## 📦 安装

```bash
# 使用 pnpm（推荐）
pnpm add @eljs/plugin-host

# 使用 yarn
yarn add @eljs/plugin-host

# 使用 npm
npm install @eljs/plugin-host -S
```

需要 Node.js `>=22.14.0`。`@eljs/plugin-host` 将 TypeScript 作为运行时依赖提供，
用于加载 `.ts` 和 `.cts` 插件。

## 🚀 快速开始

### 基本用法

在同一目录中创建以下两个文件。插件声明接受模块名或本地路径，
因此本示例定义一个本地插件，无需依赖外部插件包。

```ts
// runner.ts
import {
  PluginHost,
  defineEventHook,
  defineHooks,
  defineModifyHook,
  type PluginHostOptions,
  type PluginContext,
  type UserConfig,
} from '@eljs/plugin-host'

export const runnerHooks = defineHooks({
  onStart: defineEventHook(),
  onBuild: defineEventHook(),
  modifyConfig: defineModifyHook<Record<string, unknown>>(),
})

export type RunnerPluginContext = PluginContext<typeof runnerHooks>

// 创建由插件驱动的运行器
export class Runner extends PluginHost<UserConfig, typeof runnerHooks> {
  public constructor(options: PluginHostOptions) {
    super(options, runnerHooks)
  }

  public async run() {
    // 从配置中加载预设和插件
    await this.load()

    // 执行钩子
    await this.runHook('onStart')
    await this.runHook('onBuild')

    const config = await this.runHook('modifyConfig', {
      initialValue: { outputDir: 'dist' },
    })
    console.log(config)
  }
}

// 初始化并运行
const runner = new Runner({
  cwd: process.cwd(),
  plugins: ['./hello-plugin.ts'],
})

runner.run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
```

```ts
// hello-plugin.ts
import { definePlugin } from '@eljs/plugin-host'
import type { RunnerPluginContext } from './runner'

export default definePlugin<Record<string, never>, RunnerPluginContext>(
  context => {
    context.describe({ key: 'hello-plugin' })
    context.onStart(() => {
      console.log('Build started')
    })
    context.onBuild(() => {
      console.log('Building')
    })
    context.modifyConfig(config => ({
      ...config,
      outputDir: 'build',
    }))
  },
)
```

在该目录中使用 Node.js 类型剥离功能运行：

```bash
node --experimental-strip-types runner.ts
```

### 类型安全的插件开发

```ts
import { definePlugin, type PluginContext } from '@eljs/plugin-host'
import type { runnerHooks } from './runner'

type MyPluginContext = PluginContext<typeof runnerHooks>

// 使用 TypeScript 定义插件
interface MyPluginOptions {
  outputDir: string
  minify: boolean
}

// 插件实现
export default definePlugin<MyPluginOptions, MyPluginContext>(
  (
    context,
    options = {
      outputDir: 'dist',
      minify: true,
    },
  ) => {
    // 描述插件元数据
    context.describe({
      key: 'my-custom-plugin',
      enable: () => options.minify !== false,
    })

    // 注册钩子
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

    // 注册自定义能力
    context.registerCapability(
      'customBuild',
      async (buildOptions: Record<string, unknown>) => {
        return { ...buildOptions, outputDir: options.outputDir }
      },
    )
  },
)
```

`definePlugin()` 和 `definePreset()` 是返回原值的辅助函数：以函数作为参数调用时，
它们添加上下文类型推导，不对运行时行为进行包装。需要在运行时校验选项的插件，
可以使用对象形式并搭配任意兼容 Standard Schema 的校验器。eljs 插件推荐使用 Zod：

```bash
pnpm add zod
```

```ts
import { definePlugin, type PluginContext } from '@eljs/plugin-host'
import { z } from 'zod'
import type { runnerHooks } from './runner'

type MyPluginContext = PluginContext<typeof runnerHooks>

export default definePlugin({
  optionsSchema: z
    .object({
      outputDir: z.string().default('dist'),
      minify: z.boolean().default(true),
    })
    .prefault({}),
  initialize(context: MyPluginContext, options) {
    // `options` 包含解析后的输出，包括默认值和转换结果
    context.onStart(() => {
      console.log(`Building into ${options.outputDir}`)
    })
  },
})
```

Schema 在初始化前校验插件声明的第二项。其输入类型描述用户配置，
输出类型则描述初始化函数的 `options` 参数。如果声明允许省略选项，Schema 必须接受 `undefined`。
使用 Zod 4（本仓库使用 4.6.7）时，`.prefault({})` 会在省略选项时解析一个空对象，
因此字段默认值仍会生效。例如，将此插件保存为 `schema-plugin.ts` 后，
声明 `plugins: ['./schema-plugin.ts']` 会以 `{ outputDir: 'dist', minify: true }` 初始化它。
Valibot、ArkType、Yup 和其他兼容 Standard Schema 的校验器无需适配器即可使用。
使用单数形式 `definePreset()`，因为每次调用都定义一个预设，即使该预设返回多个嵌套声明也是如此。

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

### 扩展插件上下文（进阶）

如果你正在基于 `@eljs/plugin-host` 构建复杂框架，可能希望将自定义属性或工具
直接注入插件上下文，让所有插件都能便捷地访问它们。

可以通过在运行器类中重写 `getPluginContextExtensions()` 来实现。

```ts
import {
  PluginHost,
  type Plugin,
  type PluginContext,
  type UserConfig,
} from '@eljs/plugin-host'
import type { runnerHooks } from './runner'

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
      // 插件可以调用：context.logger('msg')
      logger: (msg: string) => {
        console.log(`[Plugin: ${plugin.id}] ${msg}`)
      },

      // 插件可以访问：context.frameworkVersion
      frameworkVersion: '1.0.0',

      // 扩展名称不得与 PluginApi 或 Hook Schema 中的名称冲突
    }
  }
}

// 在插件内部：
export default function plugin(
  context: PluginContext<typeof runnerHooks, CustomCapabilities>,
) {
  context.logger('Hello from custom API!')
}
```

运行器的属性和方法不会自动暴露。插件只能访问核心 `PluginApi` 方法、
Hook Schema 注册方法、显式扩展，以及通过 `registerCapability()` 添加的能力。

## 📖 API 参考

### 扩展 `PluginHost`

```ts
abstract class PluginHost<Config, Schema, Extensions> {
  constructor(options: PluginHostOptions, hookSchema?: Schema)
}

interface PluginHostOptions {
  /**
   * 工作目录
   */
  cwd: string
  /**
   * 在生命周期边界停止插件加载和钩子执行
   */
  signal?: AbortSignal
  /**
   * 预设声明
   */
  presets?: readonly PluginDeclaration[]
  /**
   * 插件声明
   */
  plugins?: readonly PluginDeclaration[]
  /**
   * 默认配置文件
   * @example
   * ['config.ts', 'config.js']
   */
  defaultConfigFiles?: readonly string[]
  /**
   * 默认配置文件扩展名
   * @example
   * ['dev', 'staging'] => ['config.dev.ts', 'config.staging.ts']
   */
  defaultConfigExts?: readonly string[]
}

type PluginDeclaration<Options = Record<string, unknown>> =
  string | readonly [string, Options]
```

已中止的信号会产生 `PluginHostErrorCode.OperationAborted`。宿主在插件初始化函数和各个钩子
执行前后检查取消状态，因此正在执行的回调可以完成，但后续回调不会启动。

### Hook Schema

Hook Schema 是运行时钩子类型和插件注册方法的唯一事实来源。

```ts
const hooks = defineHooks({
  addEntries: defineAddHook<{ isDev: boolean }, string[]>(),
  modifyConfig: defineModifyHook<Config, { env: string }>(),
  getResult: defineGetHook<{ query: string }, Result>(),
  onComplete: defineEventHook<{ stats: BuildStats }>(),
})
```

`runHook()` 只接受 Schema 中的键，并从中推导选项和返回值。
`HookRegistrationApi<typeof hooks>` 则推导插件端对应的方法。

### 核心方法

#### `load()` - 加载预设和插件

```ts
protected async load(): Promise<void>
```

根据配置文件和构造函数选项加载并初始化所有预设和插件。
每个实例只能加载一次。加载成功后进入 `ready` 状态；
加载失败后进入终态 `failed`，并清除已完成的部分注册。

**特性：**

- 自动发现和解析配置文件
- 解析嵌套预设
- 注册嵌套预设/插件并检测重复项
- 提供详细消息的错误处理

#### `runHook()` - 执行插件钩子

```ts
async runHook<Key extends keyof Schema & string>(
  key: Key,
  ...args: HookRunArguments<Schema[Key]>
): Promise<HookRunResult<Schema[Key]>>
```

Schema 决定选项是否可选、是否需要 `initialValue`、`args` 的结构和结果类型。
`LooseHookRunOptions` 和显式的运行时 `kind` 仅为无 Schema 的兼容用法保留。

**钩子类型说明：**

```ts
// Add 钩子 - 将结果累积到数组中
const items = await this.runHook('addItems', {
  initialValue: [],
  args: { mode: 'build' },
})
// 结果：[...item1, ...item2, ...item3]

// Modify 钩子 - 通过调用链转换值
const config = await this.runHook('modifyConfig', {
  initialValue: baseConfig,
  args: { env: 'production' },
})
// 结果：转换后的配置对象

// Get 钩子 - 返回首个非 null 且非 undefined 的结果
const result = await this.runHook('getResult', {
  args: { query: 'something' },
})
// 结果：首个返回非 null 且非 undefined 值的插件的返回值

// Event 钩子 - 执行副作用
await this.runHook('onComplete', {
  args: { stats: buildStats },
})
// 结果：undefined（所有插件均已执行）
```

### `getPluginContextExtensions()` - 提供上下文扩展

```ts
protected getPluginContextExtensions(plugin: Plugin): Extensions
```

返回不冲突的属性和方法，它们将合并到暴露给当前插件的 `PluginContext` 中。
必须返回一个普通对象，且仅包含自身可枚举的字符串属性。
数据属性中的函数保持稳定引用，调用时以扩展对象作为 `this`；
getter 在每次访问时求值。未在此处返回的运行器成员仍保持私有。

### 插件上下文与核心 API

`PluginContext<Schema, Extensions>` 是插件初始化函数接收的完整对象。
它组合了核心 `PluginApi`、Hook Schema 注册方法和宿主提供的扩展。

#### `PluginApi` - 插件开发接口

```typescript
class PluginApi {
  /** 描述插件元数据 */
  describe(options: { key?: string; enable?: PluginHookEnablement }): void

  /** 注册钩子函数 */
  register(
    key: string,
    fn: (...args: unknown[]) => MaybePromise<unknown>,
    options?: { before?: string; stage?: number },
  ): void

  /** 注册自定义能力 */
  registerCapability(name: string, fn: Function): void

  /** 声明需要跳过钩子执行的插件键 */
  disablePluginHooks(keys: string[]): void

  /** 注册额外预设 */
  registerPresets(presets: PluginDeclaration[]): void

  /** 注册额外插件 */
  registerPlugins(plugins: PluginDeclaration[]): void
}

type PluginHookEnablement = boolean | (() => boolean)
```

`enable` 和 `disablePluginHooks()` 仅控制钩子执行。它们不会阻止插件初始化，
也不会撤销初始化期间注册的能力和产生的副作用。要完全避免加载某个插件，
需从 `plugins` 或 `presets` 声明中移除它。跳过声明在注册完成后解析，因此不依赖插件顺序。

提供 Hook Schema 时，`register()` 还会拒绝 Schema 中未声明的键。
优先使用 Schema 生成的方法（如 `context.modifyConfig()`）作为注册接口。

### 错误

插件宿主的领域错误使用 `PluginHostError`，具有稳定的 `code`、`cause` 和结构化的 `details`。
嵌套预设/插件的初始化错误包含其声明来源和父插件信息。

### 插件模块格式

插件入口文件支持 `.js`、`.cjs`、`.mjs`、`.ts` 和 `.cts`。
`.jsx`、`.tsx`、`.mts` 以及仅通过 exports 定义入口的包不在支持契约范围内。
本包将 TypeScript 作为运行时依赖提供，用于加载 `.ts` 和 `.cts` 插件。
加载器在执行每个 `.ts` 或 `.cts` 模块前检查语法，包括其相对依赖，
并在成功或失败后恢复临时 require 钩子。它使用固定的 CommonJS 编译器选项，不执行完整类型检查。
如果后续依赖加载失败，此前已执行模块产生的副作用不会回滚。

### 信任模型

插件和 JavaScript/TypeScript 配置文件在当前 Node.js 进程中以当前进程权限执行。
仅加载可信的插件和配置。

## 🎯 钩子系统

### 钩子执行顺序

钩子支持通过 `stage` 和 `before` 选项控制执行顺序：

```typescript
import { definePlugin, type PluginContext } from '@eljs/plugin-host'
import type { runnerHooks } from './runner'

type Context = PluginContext<typeof runnerHooks>

// 将每个初始化函数保存到独立的插件模块中，并在宿主中声明全部四个插件
// 每个回调都接收并返回配置值
export const pluginA = definePlugin<Record<string, never>, Context>(context => {
  context.describe({ key: 'plugin-a' })
  context.modifyConfig(config => ({ ...config, a: true }), { stage: -100 })
})

export const pluginB = definePlugin<Record<string, never>, Context>(context => {
  context.describe({ key: 'plugin-b' })
  context.modifyConfig(config => ({ ...config, b: true }), {
    before: 'plugin-c',
  })
})

export const pluginC = definePlugin<Record<string, never>, Context>(context => {
  context.describe({ key: 'plugin-c' })
  context.modifyConfig(config => ({ ...config, c: true }))
})

export const pluginD = definePlugin<Record<string, never>, Context>(context => {
  context.describe({ key: 'plugin-d' })
  context.modifyConfig(config => ({ ...config, d: true }), { stage: 100 })
})
```

将每个初始化函数作为其模块的默认导出。对于这些注册，即使 C 在 B 之前声明，
执行顺序仍为 A → B → C → D。`before` 指向目标插件的 `describe({ key })` 值；
在没有 `before` 约束覆盖顺序时，较小的 `stage` 会更早执行。

### 钩子类型详解

#### Add 钩子

```typescript
// 注册 Add 钩子
context.addEntries(async ({ isDev }) => {
  return isDev ? ['dev-entry.js'] : ['prod-entry.js']
})

// 应用 Add 钩子
const entries = await this.runHook('addEntries', {
  initialValue: ['main.js'],
  args: { isDev: process.env.NODE_ENV === 'development' },
})
// 结果：['main.js', 'dev-entry.js'] 或 ['main.js', 'prod-entry.js']
```

#### Modify 钩子

```typescript
// 注册 Modify 钩子
context.modifyWebpackConfig(async (config, { target }) => {
  if (target === 'node') {
    config.target = 'node'
    config.externals = nodeExternals()
  }
  return config
})

// 应用 Modify 钩子
const webpackConfig = await this.runHook('modifyWebpackConfig', {
  initialValue: baseConfig,
  args: { target: 'browser' },
})
```

## 🧩 插件开发指南

### 创建插件

```typescript
// my-awesome-plugin.ts
import {
  defineAddHook,
  defineEventHook,
  defineHooks,
  defineModifyHook,
  definePlugin,
  type PluginContext,
} from '@eljs/plugin-host'

interface BuildConfig {
  output: string
  minification: boolean
  target: 'browser' | 'node'
}

// 将同一个 Schema 传给宿主构造函数
export const buildHooks = defineHooks({
  addEntries: defineAddHook<void, string[]>(),
  modifyConfig: defineModifyHook<BuildConfig, { isDev: boolean }>(),
  onBuildStart: defineEventHook(),
  onBuildComplete: defineEventHook<{ stats: { duration: number } }>(),
})

type MyPluginContext = PluginContext<typeof buildHooks>

export interface MyPluginOptions {
  outputDir?: string
  minify?: boolean
  target?: 'browser' | 'node'
}

const myAwesomePlugin = definePlugin<MyPluginOptions, MyPluginContext>(
  (context, options = {}) => {
    const { outputDir = 'dist', minify = true, target = 'browser' } = options

    // 描述插件
    context.describe({
      key: 'my-awesome-plugin',
      enable: () => true, // 始终启用
    })

    // 添加配置入口
    context.addEntries(() => {
      return target === 'node' ? ['src/server.js'] : []
    })

    // 修改构建配置
    context.modifyConfig(
      (config, { isDev }) => {
        return {
          ...config,
          output: outputDir,
          minification: minify && !isDev,
          target,
        }
      },
      { stage: -50 },
    ) // 提前执行

    // 添加构建事件监听器
    context.onBuildStart(async () => {
      console.log('🚀 Starting build process...')
    })

    context.onBuildComplete(async ({ stats }) => {
      console.log(`✨ Build completed in ${stats.duration}ms`)
    })

    // 注册自定义方法
    context.registerCapability(
      'customOptimize',
      async (options: Record<string, unknown>) => {
        // 自定义优化逻辑
        return { optimized: true, ...options }
      },
    )
  },
)

export default myAwesomePlugin

// 导出类型供用户使用
export type MyAwesomePlugin = typeof myAwesomePlugin
```

### 使用插件

```typescript
import {
  PluginHost,
  type PluginHostOptions,
  type UserConfig,
} from '@eljs/plugin-host'
import { buildHooks } from './my-awesome-plugin'

class BuildTool extends PluginHost<UserConfig, typeof buildHooks> {
  public constructor(options: PluginHostOptions) {
    super(options, buildHooks)
  }

  public async run() {
    await this.load()
    await this.runHook('onBuildStart')
    const config = await this.runHook('modifyConfig', {
      initialValue: { output: 'dist', minification: true, target: 'browser' },
      args: { isDev: false },
    })
    console.log(config)
    await this.runHook('onBuildComplete', { args: { stats: { duration: 0 } } })
  }
}

// 配置
const runner = new BuildTool({
  cwd: process.cwd(),
  plugins: [
    // 带选项
    [
      './my-awesome-plugin.ts',
      {
        outputDir: 'build',
        minify: false,
        target: 'node',
      },
    ],
  ],
})

await runner.run()
```
