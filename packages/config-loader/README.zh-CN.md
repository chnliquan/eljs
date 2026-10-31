# @eljs/config-loader

[English](./README.md)

面向 Node.js 工具的配置发现、加载、合并和校验能力。

[![NPM Version](https://img.shields.io/npm/v/@eljs/config-loader.svg)](https://www.npmjs.com/package/@eljs/config-loader)
[![License](https://img.shields.io/npm/l/@eljs/config-loader.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## 运行要求

- Node.js 22.14 或更高版本
- 提供 ESM、CommonJS 入口和 TypeScript 声明

## 安装

```bash
pnpm add @eljs/config-loader
```

## 快速开始

创建 `app.config.json`：

```json
{
  "server": { "port": 8080 }
}
```

加载配置并提供默认值：

```ts
import { ConfigLoader } from '@eljs/config-loader'

const loader = new ConfigLoader({
  defaultConfigFiles: ['app.config.ts', 'app.config.js', 'app.config.json'],
  cwd: process.cwd(),
})

const config = await loader.getConfig({
  server: { host: 'localhost', port: 3000 },
})

console.log(config.server) // { host: 'localhost', port: 8080 }
console.log(loader.mainConfigFile) // app.config.json 的绝对路径
```

只选择候选列表中第一个已存在的普通文件。提供默认配置时，结果不会为空，
TypeScript 类型从默认配置推导。未提供默认配置且没有发现配置时，
`getConfig()` 返回 `null`。TypeScript 类型推导不会校验文件内容。

## 发现与合并顺序

```ts
const loader = new ConfigLoader({
  defaultConfigFiles: ['app.config.ts', 'app.config.json'],
  defaultConfigExts: ['local', 'development'],
  cwd: './config',
})
```

如果 `app.config.ts` 存在，加载顺序为：

```text
默认配置
→ app.config.ts
→ app.config.local.ts
→ app.config.development.ts
→ 最终校验
```

缺失的环境配置文件会被跳过。后加载的值覆盖先加载的值；默认深度合并会拼接数组。
如果需要替换数组或采用其他合并策略，请提供 `merge`。

环境后缀需要显式传入字符串。加载器不会加载 `.env` 文件，也不会自动解释 `NODE_ENV`。

## API

### 构造函数

```ts
import type { ConfigLoaderOptions } from '@eljs/config-loader'

const options: ConfigLoaderOptions = {
  defaultConfigFiles: ['app.config.json'],
  defaultConfigExts: ['local'],
  cwd: process.cwd(),
}
```

| 选项                                    | 契约                                                       |
| --------------------------------------- | ---------------------------------------------------------- |
| `defaultConfigFiles: readonly string[]` | 有序主配置候选列表，选择第一个普通文件                     |
| `defaultConfigExts?: readonly string[]` | 环境后缀，按声明顺序合并                                   |
| `cwd?: string`                          | 相对路径的解析基准，默认为 `process.cwd()`                 |
| `merge?: ConfigMerge`                   | 同步合并回调，必须保持调用方预期的数据形状，且不能修改输入 |
| `validate?: ConfigValidator`            | 合并后的同步校验或规范化回调                               |
| `reload?: boolean`                      | 重新求值异步加载的 JavaScript 入口模块                     |

`constructorOptions` 是只读快照，包含候选列表和后缀数组的冻结副本。
`mainConfigFile` 反映最近一次实例加载结果；首次加载前或没有发现候选文件时为 `undefined`。

### 实例加载

```ts
const optionalConfig = await loader.getConfig()
const configWithDefaults = await loader.getConfig({ enabled: true })
const synchronousConfig = loader.getConfigSync({ enabled: true })
```

### 静态加载

静态方法按顺序加载并合并所有传入文件，不会只选择一个主配置候选。请传入绝对路径：

```ts
import { ConfigLoader, getAbsFiles } from '@eljs/config-loader'

const files = getAbsFiles(['base.config.json', 'override.config.json'])
const config = await ConfigLoader.getConfig(files, { enabled: true })
const syncConfig = ConfigLoader.getConfigSync(files, { enabled: true })

// 不提供默认配置时，也可以传入加载选项
const optionalConfig = await ConfigLoader.getConfig(files, undefined, {
  reload: true,
})
```

异步和同步方法都接受 `readonly string[]`。其他静态辅助方法：

```ts
ConfigLoader.getMainConfigFile(files, process.cwd())
ConfigLoader.getMainConfigFileSync(files, process.cwd())
ConfigLoader.getConfigFiles('/workspace/app.config.ts', ['local', 'dev'])
```

最后一个调用返回主配置路径，随后是环境配置路径。后缀参数也接受 `readonly string[]`。

### 路径辅助函数

```ts
import { addFileExt, getAbsFiles } from '@eljs/config-loader'

addFileExt('app.config.ts', 'dev') // app.config.dev.ts
getAbsFiles(['app.config.json'], '/workspace') // ['/workspace/app.config.json']
```

## 文件格式

| 格式       | 扩展名          | 异步 | 同步 |
| ---------- | --------------- | ---- | ---- |
| JavaScript | `.js`, `.cjs`   | 是   | 是   |
| 原生 ESM   | `.mjs`          | 是   | 否   |
| TypeScript | `.ts`           | 是   | 是   |
| JSON       | `.json`         | 是   | 是   |
| YAML       | `.yaml`, `.yml` | 是   | 是   |

JavaScript 模块行为遵循所在包的模块类型。同步加载 `.mjs` 会产生
`CONFIG_SYNC_FORMAT_UNSUPPORTED`。TypeScript 通过短生命周期的 CommonJS 转译 Hook 加载；
支持相对 `.ts` 依赖，不解析 TypeScript 路径别名。

## 校验与重新加载

```ts
import { ConfigLoader } from '@eljs/config-loader'

const loader = new ConfigLoader({
  defaultConfigFiles: ['app.config.json'],
  validate(config, context) {
    if (
      !('server' in config) ||
      !config.server ||
      typeof config.server !== 'object'
    ) {
      throw new TypeError('server configuration is required')
    }
    console.log(context.loadedConfigFiles)
    return config
  },
})
```

`context.configFiles` 包含所有声明的输入路径。
`context.loadedConfigFiles` 包含实际产出配置对象并参与合并的文件，顺序与合并顺序一致。

配置根对象、默认配置和回调结果都必须是普通对象。支持嵌套数组，但不支持根数组和类实例。
自定义 `merge` 和 `validate` 回调必须保持同步，并返回与调用方声明类型兼容的对象。

设置 `reload: true` 可重新求值异步加载的 JavaScript 入口模块。其导入依赖仍遵循
Node.js 模块缓存。同步 CommonJS 入口加载本身已保持最新。每次 ESM 重新加载都会创建
新的模块实例，因此应在受控开发或刷新流程中使用。

## 错误与执行边界

缺失候选和非文件路径会被跳过。已存在但无法解析或执行的文件会导致加载失败。
加载、合并和校验失败使用 `ConfigLoadError`；应根据 `error.code` 分支处理，而不是解析消息：

```ts
import { ConfigLoadError } from '@eljs/config-loader'

try {
  await loader.getConfig()
} catch (error) {
  if (error instanceof ConfigLoadError) {
    console.error(error.code, error.configFile, error.cause)
  }
  throw error
}
```

JavaScript 和 TypeScript 配置以当前进程权限执行。仅从可信位置加载配置。

## 开发

在仓库根目录运行：

```bash
pnpm --filter @eljs/config-loader typecheck
pnpm --filter @eljs/config-loader test
pnpm --filter @eljs/config-loader build
```
