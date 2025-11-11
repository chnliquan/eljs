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

### `configManager.getConfig()`

```ts
// 不带默认配置（原有API）
async getConfig<T extends object>(): Promise<T | null>

// 带默认配置（新增功能）✨
async getConfig<T extends Record<string, any>>(defaultConfig: T): Promise<T>
```

返回异步合并后的配置对象。

**参数:**
- `defaultConfig` (可选) - 默认配置对象，提供类型推断和默认值

**特性:**
- 🎯 **自动类型推断** - 从 defaultConfig 自动推断返回类型
- 🔄 **深度合并** - 默认配置与加载的配置智能合并
- ✅ **类型安全** - 完整的 TypeScript 类型支持
- 🛡️ **空值保护** - 确保配置文件不存在时也有默认值

### `configManager.getConfigSync()`

```ts
// 不带默认配置（原有API）
getConfigSync<T extends object>(): T | null

// 带默认配置（新增功能）✨
getConfigSync<T extends Record<string, any>>(defaultConfig: T): T
```

返回同步合并后的配置对象。具有与异步版本相同的特性。

## 静态方法

### `ConfigManager.getConfig()`

```ts
// 不带默认配置
static async getConfig<T extends object>(configFiles: string[]): Promise<T | null>

// 带默认配置（新增功能）✨
static async getConfig<T extends Record<string, any>>(
  configFiles: string[], 
  defaultConfig: T
): Promise<T>
```

直接加载指定的配置文件列表。

### `ConfigManager.getConfigSync()`

```ts
// 不带默认配置
static getConfigSync<T extends object>(configFiles: string[]): T | null

// 带默认配置（新增功能）✨
static getConfigSync<T extends Record<string, any>>(
  configFiles: string[], 
  defaultConfig: T
): T
```

同步版本的直接配置文件加载。

### 其他静态方法

- `ConfigManager.getMainConfigFile()` - 查找主配置文件
- `ConfigManager.getMainConfigFileSync()` - 同步查找主配置文件  
- `ConfigManager.getConfigFiles()` - 生成配置文件列表

## 使用示例

### 1. 智能类型推断

```ts
// 🎯 零配置类型推断 - 推荐方式
const defaultConfig = {
  server: {
    host: 'localhost',
    port: 3000,
    ssl: false
  },
  database: {
    type: 'postgresql' as 'postgresql' | 'mysql',
    host: 'localhost',
    port: 5432
  },
  features: ['auth', 'api'] as string[]
}

const configManager = new ConfigManager({
  defaultConfigFiles: ['app.config.js'],
  defaultConfigExts: [process.env.NODE_ENV || 'development']
})

// 类型自动推断，获得完整的类型安全
const config = await configManager.getConfig(defaultConfig)
// config 的类型已完全推断，无需手动指定！

// 类型安全的使用
if (config.server.ssl) {
  // TypeScript 知道 ssl 是 boolean 类型
}

console.log(`服务器端口: ${config.server.port}`) // TypeScript 知道 port 是 number
```

### 2. 多环境配置管理

```ts
const webAppDefaults = {
  server: {
    host: '127.0.0.1',
    port: 3000,
    ssl: { enabled: false, cert: '', key: '' }
  },
  database: {
    type: 'postgresql' as const,
    host: 'localhost', 
    port: 5432,
    database: 'myapp'
  },
  auth: {
    providers: ['local'] as Array<'local' | 'google' | 'github'>,
    jwt: { secret: 'default-secret', expiresIn: '24h' }
  }
}

const configManager = new ConfigManager({
  defaultConfigFiles: ['app.config.js'],
  defaultConfigExts: [process.env.NODE_ENV || 'development'],
  cwd: './config'
})

const config = await configManager.getConfig(webAppDefaults)

// 配置验证示例
if (config.server.ssl.enabled && !config.server.ssl.cert) {
  throw new Error('启用 SSL 时必须提供证书')
}

// 根据环境调整行为
if (process.env.NODE_ENV === 'production') {
  config.auth.providers.forEach(provider => {
    console.log(`生产环境启用认证: ${provider}`)
  })
}
```

### 3. 静态方法使用

```ts
// 直接加载配置文件
const apiDefaults = {
  baseUrl: 'http://localhost:3000',
  timeout: 5000,
  retries: 3,
  auth: { type: 'bearer' as 'bearer' | 'basic' }
}

const apiConfig = await ConfigManager.getConfig([
  './config/api.config.js',
  './config/api.config.prod.js'
], apiDefaults)

// 同步版本
const buildDefaults = {
  input: 'src/index.ts',
  output: { dir: 'dist', format: 'es' as const },
  minify: false
}

const buildConfig = ConfigManager.getConfigSync([
  'build.config.js'
], buildDefaults)
```

### 4. 微服务配置

```ts
const microserviceDefaults = {
  service: {
    name: 'unknown-service',
    version: '1.0.0',
    port: 3000
  },
  database: {
    enabled: false,
    type: 'postgresql' as 'postgresql' | 'mysql' | 'redis'
  },
  monitoring: {
    metrics: { enabled: true, port: 9090 },
    logging: { level: 'info' as 'debug' | 'info' | 'warn' | 'error' }
  }
}

const serviceConfig = await ConfigManager.getConfig([
  `${process.env.SERVICE_NAME}.config.js`
], microserviceDefaults)

// 类型安全的配置使用
console.log(`${serviceConfig.service.name} v${serviceConfig.service.version}`)
if (serviceConfig.database.enabled) {
  console.log(`数据库类型: ${serviceConfig.database.type}`)
}
```

## 配置文件示例
