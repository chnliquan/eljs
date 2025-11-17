# @eljs/config

Powerful configuration file loader with type-safe configuration management.

[![NPM Version](https://img.shields.io/npm/v/@eljs/config.svg)](https://www.npmjs.com/package/@eljs/config)
[![NPM Downloads](https://img.shields.io/npm/dm/@eljs/config.svg)](https://www.npmjs.com/package/@eljs/config)
[![License](https://img.shields.io/npm/l/@eljs/config.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## ✨ Features

- 🎯 **Type Safety** - Full TypeScript support with automatic type inference
- 🔄 **Smart Merging** - Deep merge default configuration with file configuration
- 📁 **Multi-Format Support** - Support for JS, TS, JSON, YAML configuration files
- 🌍 **Multi-Environment** - Support environment-specific configuration file extensions
- ⚡ **Sync/Async** - Provides both synchronous and asynchronous loading methods
- 🛡️ **Error Handling** - Friendly error messages and exception handling
- 📦 **Zero Dependencies Core** - Lightweight design with on-demand parser loading

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @eljs/config

# Using yarn
yarn add @eljs/config

# Using npm
npm install @eljs/config -S
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { ConfigManager } from '@eljs/config'

// Create configuration manager
const configManager = new ConfigManager({
  defaultConfigFiles: ['config.ts', 'config.js', 'config.json'],
  defaultConfigExts: ['local', 'development'], // Will look for config.local.ts, config.development.ts etc.
  cwd: process.cwd(), // Working directory
})

// Load configuration
const config = await configManager.getConfig()
console.log(config)
```

### Type-Safe Configuration Management (Recommended)

```typescript
interface AppConfig {
  server: {
    host: string
    port: number
    ssl: boolean
  }
  database: {
    host: string
    port: number
    name: string
  }
  features: string[]
}

const defaultConfig: AppConfig = {
  server: {
    host: 'localhost',
    port: 3000,
    ssl: false,
  },
  database: {
    host: 'localhost',
    port: 5432,
    name: 'myapp',
  },
  features: ['auth', 'api'],
}

const configManager = new ConfigManager({
  defaultConfigFiles: ['app.config.ts', 'app.config.js'],
})

// 🎯 Automatic type inference, guaranteed non-null return
const config = await configManager.getConfig(defaultConfig)

// Complete type safety
console.log(config.server.host) // ✅ TypeScript knows this is string
console.log(config.server.port) // ✅ TypeScript knows this is number
```

## 📖 API Reference

### ConfigManager Constructor

```typescript
new ConfigManager(options: ConfigManagerOptions)

interface ConfigManagerOptions {
  /** Default configuration file list */
  defaultConfigFiles: string[]
  /** Configuration file extensions (optional) */
  defaultConfigExts?: string[]
  /** Working directory (default: process.cwd()) */
  cwd?: string
}
```

### Instance Methods

#### `getConfig()` - Asynchronous Configuration Loading

```typescript
// Without default configuration
async getConfig<T extends Record<string, any> = Record<string, any>>(): Promise<T | null>

// With default configuration (recommended)
async getConfig<T extends Record<string, any>>(defaultConfig: T): Promise<T>
```

**Features:**

- Automatically finds and loads configuration files
- Supports multi-file merging (in order of `defaultConfigFiles` and `defaultConfigExts`)
- Deep merges default configuration with file configuration
- Guarantees non-null return when default configuration is provided

**Example:**

```typescript
// Without default configuration
const config = await configManager.getConfig<AppConfig>()
if (config) {
  console.log(config.server.port)
}

// With default configuration (recommended)
const config = await configManager.getConfig(defaultConfig)
console.log(config.server.port) // Guaranteed accessible, no null check needed
```

#### `getConfigSync()` - Synchronous Configuration Loading

```typescript
// Without default configuration
getConfigSync<T extends Record<string, any> = Record<string, any>>(): T | null

// With default configuration
getConfigSync<T extends Record<string, any>>(defaultConfig: T): T
```

Same functionality as the async version, but loads configuration files synchronously.

### Static Methods

#### `ConfigManager.getConfig()` - Static Asynchronous Loading

```typescript
// Without default configuration
static async getConfig<T extends Record<string, any> = Record<string, any>>(
  configFiles: string[]
): Promise<T | null>

// With default configuration
static async getConfig<T extends Record<string, any>>(
  configFiles: string[],
  defaultConfig: T
): Promise<T>
```

Directly loads specified configuration file list without creating a ConfigManager instance.

**Example:**

```typescript
// Load specific configuration files
const config = await ConfigManager.getConfig(
  ['/path/to/base.config.js', '/path/to/override.config.js'],
  defaultConfig,
)
```

#### `ConfigManager.getConfigSync()` - Static Synchronous Loading

Synchronous version of static configuration loading.

#### Other Static Methods

```typescript
// Find main configuration file
static async getMainConfigFile(configFiles: string[], cwd?: string): Promise<string | undefined>
static getMainConfigFileSync(configFiles: string[], cwd?: string): string | undefined

// Generate configuration file list
static getConfigFiles(mainConfigFile: string, configExts: string[]): string[]
```

### Utility Functions

```typescript
import { addFileExt, getAbsFiles } from '@eljs/config'

// Add extension to file
addFileExt('config.js', 'dev') // => 'config.dev.js'

// Convert to absolute paths
getAbsFiles(['config.js', '/abs/path.js']) // => ['/cwd/config.js', '/abs/path.js']
```

## 📁 Supported File Formats

| Format         | Extensions            | Loading Method    | Description                          |
| -------------- | --------------------- | ----------------- | ------------------------------------ |
| **JavaScript** | `.js`, `.mjs`, `.cjs` | Dynamic import    | Supports ES modules and CommonJS     |
| **TypeScript** | `.ts`                 | Compile then load | Automatically compiles to JavaScript |
| **JSON**       | `.json`               | JSON.parse        | Standard JSON format                 |
| **YAML**       | `.yaml`, `.yml`       | js-yaml           | Human-friendly configuration format  |

## 📝 Configuration File Examples

### JavaScript Configuration (config.js)

```javascript
module.exports = {
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
  },
}
```

### TypeScript Configuration (config.ts)

```typescript
interface Config {
  server: { host: string; port: number }
  database: { host: string; port: number }
}

const config: Config = {
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
  },
}

export default config
```

### JSON Configuration (config.json)

```json
{
  "server": {
    "host": "localhost",
    "port": 3000
  },
  "database": {
    "host": "localhost",
    "port": 5432
  }
}
```

### YAML Configuration (config.yaml)

```yaml
server:
  host: localhost
  port: 3000

database:
  host: localhost
  port: 5432

features:
  - auth
  - api
  - logging
```

## 🌍 Multi-Environment Configuration

### Configuration File Structure

```
project/
├── config/
│   ├── app.config.ts          # Base configuration
│   ├── app.config.local.ts    # Local development configuration
│   ├── app.config.dev.ts      # Development environment configuration
│   ├── app.config.staging.ts  # Staging environment configuration
│   └── app.config.prod.ts     # Production environment configuration
└── src/
```

### Configuration Loading Example

```typescript
const env = process.env.NODE_ENV || 'development'

const configManager = new ConfigManager({
  defaultConfigFiles: ['app.config.ts'],
  defaultConfigExts: [env], // Automatically loads corresponding environment configuration
  cwd: './config',
})

// Loading order: app.config.ts -> app.config.development.ts
const config = await configManager.getConfig(defaultConfig)
```

### Environment-Specific Configuration

```typescript
// app.config.prod.ts
export default {
  server: {
    host: '0.0.0.0',
    port: 80,
    ssl: true,
  },
  database: {
    host: process.env.DATABASE_HOST,
    port: 5432,
    ssl: true,
    poolSize: 20,
  },
  logging: {
    level: 'warn',
  },
}
```
