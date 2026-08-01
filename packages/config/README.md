# @eljs/config

Configuration file loader for Node.js with layered merging, TypeScript inference, runtime validation hooks, and structured errors.

[![NPM Version](https://img.shields.io/npm/v/@eljs/config.svg)](https://www.npmjs.com/package/@eljs/config)
[![NPM Downloads](https://img.shields.io/npm/dm/@eljs/config.svg)](https://www.npmjs.com/package/@eljs/config)
[![License](https://img.shields.io/npm/l/@eljs/config.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## ✨ Features

- 🎯 **Type Inference** - Generic return types and inference from default configuration
- ✅ **Runtime Validation** - Optional synchronous validation and normalization hook
- 🔄 **Smart Merging** - Deep merge default configuration with file configuration
- 📁 **Multi-Format Support** - Support for JS, TS, JSON, YAML configuration files
- 🌍 **Multi-Environment** - Support environment-specific configuration file extensions
- ⚡ **Sync/Async** - Provides synchronous and asynchronous APIs with explicit format boundaries
- 🛡️ **Structured Errors** - Stable error codes, failed file metadata, and original `cause`
- ♻️ **Explicit Reloading** - Optional cache bypass for asynchronous JavaScript loading

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

### Type-Inferred Configuration Management

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

// Compile-time inference; use validate for runtime guarantees
console.log(config.server.host) // ✅ TypeScript knows this is string
console.log(config.server.port) // ✅ TypeScript knows this is number
```

## 📖 API Reference

### ConfigManager Constructor

```typescript
new ConfigManager(options: ConfigManagerOptions)

interface ConfigManagerOptions {
  /** Ordered candidates; only the first existing file is selected */
  defaultConfigFiles: readonly string[]
  /** Ordered environment suffixes */
  defaultConfigExts?: readonly string[]
  /** Working directory (default: process.cwd()) */
  cwd?: string
  /** Optional custom merge function */
  merge?: (baseConfig: object, overrideConfig: object) => object
  /** Bypass the async JavaScript module cache */
  reload?: boolean
  /** Synchronous final validation and normalization */
  validate?: (config: object, context: ConfigValidationContext) => object
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
- Selects the first existing `defaultConfigFiles` candidate, then merges files derived from `defaultConfigExts`
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

The synchronous API supports `.cjs`, `.js`, `.ts`, `.json`, `.yaml`, and `.yml`. Native `.mjs` modules require the asynchronous API and produce `CONFIG_SYNC_FORMAT_UNSUPPORTED` when passed to the synchronous API.

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
  defaultConfig: T,
  options?: ConfigLoadOptions
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

| Format         | Extensions      | Async | Sync | Description                              |
| -------------- | --------------- | ----- | ---- | ---------------------------------------- |
| **JavaScript** | `.js`, `.cjs`   | Yes   | Yes  | Supports CommonJS and package-scoped ESM |
| **ES Module**  | `.mjs`          | Yes   | No   | Native ESM requires dynamic import       |
| **TypeScript** | `.ts`           | Yes   | Yes  | Compiles to a temporary CommonJS file    |
| **JSON**       | `.json`         | Yes   | Yes  | Standard JSON format                     |
| **YAML**       | `.yaml`, `.yml` | Yes   | Yes  | Parsed with js-yaml                      |

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

## Validation, Merging, and Reloading

The generic return type describes the caller's expected shape; it does not validate file contents. Use `validate` when configuration is a trust boundary:

```typescript
const configManager = new ConfigManager({
  defaultConfigFiles: ['app.config.json'],
  validate(config) {
    if (!('server' in config) || typeof config.server !== 'object') {
      throw new TypeError('server configuration is required')
    }
    return config
  },
})
```

Arrays are concatenated by the default deep merge. Provide `merge` when arrays should be replaced or another domain-specific policy is required. The callback must return a new object and must not mutate its inputs.

Node.js caches imported JavaScript modules. Set `reload: true` to bypass that cache in asynchronous watch or development workflows. Synchronous CommonJS loading is already fresh. Each native ESM reload creates a new module instance, so avoid unbounded reload loops in long-running production processes.

## Error Handling

All format, loading, merging, and validation failures use `ConfigLoadError`. Branch on `error.code` rather than parsing messages:

```typescript
import { ConfigErrorCode, ConfigLoadError } from '@eljs/config'

try {
  await configManager.getConfig()
} catch (error) {
  if (
    error instanceof ConfigLoadError &&
    error.code === ConfigErrorCode.UnsupportedFormat
  ) {
    console.error(error.configFile, error.format)
  }
  throw error
}
```

## Security and Runtime Constraints

- Load JavaScript and TypeScript configuration only from trusted locations; those files execute with the current process privileges
- TypeScript loading writes a uniquely named temporary CommonJS file beside the source and removes it in a `finally` block, so the source directory must be writable
- Missing candidate files are skipped, while existing files that cannot be parsed or executed fail the load
- Environment variables are read only when user configuration code accesses `process.env`; this package does not load `.env` files or interpolate values

## Development

```bash
pnpm --filter @eljs/config test
pnpm --filter @eljs/config test:watch
pnpm --filter @eljs/config typecheck
pnpm --filter @eljs/config build
```
