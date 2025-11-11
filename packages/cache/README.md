# @eljs/cache

An intelligent, high-performance caching system with zero-configuration setup and smart cleanup capabilities

[![NPM Version](https://img.shields.io/npm/v/@eljs/cache.svg)](https://www.npmjs.com/package/@eljs/cache)
[![NPM Downloads](https://img.shields.io/npm/dm/@eljs/cache.svg)](https://www.npmjs.com/package/@eljs/cache)
[![License](https://img.shields.io/npm/l/@eljs/cache.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## ✨ Features

- 🚀 **Zero Configuration** - Works out of the box with sensible defaults
- ⚡ **High Performance** - Memory + disk dual-layer caching
- 🧹 **Smart Cleanup** - Automatic cleanup of expired and invalid caches
- 🔒 **Type Safety** - Full TypeScript support with generics
- 📊 **Observable** - Built-in statistics and monitoring
- 🎯 **Flexible** - Customizable key generation, serialization, and validation
- 🛡️ **Robust** - Intelligent cache invalidation and error handling

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @eljs/cache

# Using yarn
yarn add @eljs/cache

# Using npm
npm install @eljs/cache -S
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { Cache } from '@eljs/cache'

// Create cache instance
const cache = new Cache<string>()

// File-based caching
await cache.set('./config.json', 'cached data')
const data = await cache.get('./config.json')

// Data-based caching
await cache.setByData('my data')
const result = await cache.getByKey('generated-key')
```

### Type-Safe Caching (Recommended)

```typescript
interface UserData {
  id: string
  name: string
  email: string
  lastUpdated: number
}

// Create typed cache instance
const userCache = new Cache<UserData>({
  cacheDir: './user-cache',
  ttlDays: 1,
})

// Type-safe operations
const userData: UserData = {
  id: '123',
  name: 'John Doe',
  email: 'john@example.com',
  lastUpdated: Date.now()
}

await userCache.setByData(userData)
const cachedUser = await userCache.getByKey('user-123') // Type: UserData | null
```

## 📖 API Reference

### Cache Constructor

```typescript
new Cache<T>(options?: CacheOptions<T>)

interface CacheOptions<T> {
  /** Whether to enable caching (default: true) */
  enabled?: boolean
  /** Cache directory path (default: os.tmpdir() + '/.eljs-cache') */
  cacheDir?: string
  /** Cache time-to-live in days (default: 7) */
  ttlDays?: number
  /** Whether to automatically clean up expired files on startup (default: true) */
  autoCleanup?: boolean
  /** Maximum number of cache files (default: 1000) */
  maxFiles?: number
  /** Custom serializer for data persistence */
  serializer?: CacheSerializer<T>
  /** Custom key generation function */
  keyGenerator?: CacheKeyGenerator<T>
  /** Custom validator for cache validation */
  validator?: CacheValidator<T>
}
```

### File-Based Caching Methods

#### `get()` - Get Cached Data by File Path

```typescript
async get(filePath: string): Promise<T | null>
```

**Features:**

- Automatically validates file modification time, size, and content hash
- Returns `null` if cache is expired, invalid, or not found
- Supports both memory and disk cache layers

**Example:**

```typescript
const config = await cache.get('./app.config.json')
if (config) {
  console.log('Cache hit:', config)
} else {
  console.log('Cache miss - need to load from source')
}
```

#### `set()` - Set Cache Data for File Path

```typescript
async set(filePath: string, data: T): Promise<void>
```

Caches data associated with a specific file path, including file metadata for validation.

### Data-Based Caching Methods

#### `getByKey()` - Get Cached Data by Key

```typescript
async getByKey(key: string): Promise<T | null>
```

#### `setByData()` - Cache Arbitrary Data

```typescript
async setByData(data: T, metadata?: { timestamp?: number }): Promise<void>
```

**Example:**

```typescript
// Cache arbitrary data
await cache.setByData({ userId: '123', preferences: {...} })

// Get data by generated key
const cachedData = await cache.getByKey('generated-key')
```

### Cache Management Methods

#### `getStats()` - Get Cache Statistics

```typescript
async getStats(): Promise<CacheStats>

interface CacheStats {
  hits: number        // Cache hit count
  misses: number      // Cache miss count
  files: number       // Number of cache files
  hitRate: number     // Hit rate (0-1)
  diskUsage: number   // Disk usage in bytes
}
```

**Example:**

```typescript
const stats = await cache.getStats()
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`)
console.log(`Disk usage: ${(stats.diskUsage / 1024 / 1024).toFixed(2)}MB`)
```

#### `cleanup()` - Clean Up Expired Cache

```typescript
async cleanup(): Promise<CleanupResult>

interface CleanupResult {
  removed: number      // Number of files removed
  totalSize: number    // Space freed in bytes
  errors: string[]     // Error messages
}
```

#### `clear()` - Clear All Cache

```typescript
async clear(): Promise<void>
```

Clears both memory and disk cache completely.

## 🎯 Customization

### Custom Key Generator

```typescript
const cache = new Cache<UserData>({
  keyGenerator: (user) => {
    // Generate unique key based on user data
    return `user-${user.id}-${user.email}`
  }
})
```

### Custom Serializer

```typescript
import { deflateSync, inflateSync } from 'zlib'

const cache = new Cache<any>({
  serializer: {
    serialize: (data) => {
      // Compress data before saving
      const json = JSON.stringify(data)
      return deflateSync(json).toString('base64')
    },
    deserialize: (compressed) => {
      // Decompress data after loading
      const buffer = Buffer.from(compressed, 'base64')
      const json = inflateSync(buffer).toString()
      return JSON.parse(json)
    }
  }
})
```

### Custom Validator

```typescript
const cache = new Cache<ApiResponse>({
  validator: async (entry, filePath) => {
    // Custom validation logic
    const isRecent = Date.now() - entry.timestamp < 3600000 // 1 hour
    const hasValidData = entry.data && entry.data.status === 'success'
    return isRecent && hasValidData
  }
})
```

## 💡 Use Cases

### 1. Configuration File Caching

```typescript
interface AppConfig {
  server: { host: string; port: number }
  database: { url: string; poolSize: number }
  features: string[]
}

const configCache = new Cache<AppConfig>({
  cacheDir: './config-cache',
  ttlDays: 1,
})

class ConfigService {
  async loadConfig(configPath: string): Promise<AppConfig> {
    // Try cache first
    let config = await configCache.get(configPath)
    
    if (!config) {
      // Load from file system
      config = await this.parseConfigFile(configPath)
      await configCache.set(configPath, config)
    }
    
    return config
  }
}
```

### 2. API Response Caching

```typescript
interface ApiResponse<T> {
  data: T
  status: number
  timestamp: number
}

const apiCache = new Cache<ApiResponse<any>>({
  keyGenerator: (response) => {
    // Generate key based on API endpoint and parameters
    return `api-${response.data.endpoint}-${JSON.stringify(response.data.params)}`
  },
  validator: async (entry) => {
    // Cache API responses for 30 minutes
    return Date.now() - entry.timestamp < 1800000
  }
})

class ApiService {
  async fetchData(endpoint: string, params: any) {
    const cacheKey = `api-${endpoint}-${JSON.stringify(params)}`
    
    // Check cache first
    let response = await apiCache.getByKey(cacheKey)
    
    if (!response) {
      // Make API call
      const data = await fetch(endpoint, { body: JSON.stringify(params) })
      response = {
        data: await data.json(),
        status: data.status,
        timestamp: Date.now()
      }
      
      await apiCache.setByData(response)
    }
    
    return response
  }
}
```

### 3. Build Artifact Caching

```typescript
interface BuildArtifact {
  source: string
  output: string
  hash: string
  dependencies: string[]
  timestamp: number
}

const buildCache = new Cache<BuildArtifact>({
  cacheDir: './build-cache',
  ttlDays: 30,
  validator: async (entry, filePath) => {
    // Validate all dependencies are still up to date
    for (const dep of entry.data.dependencies) {
      const stats = await fs.stat(dep).catch(() => null)
      if (!stats || stats.mtimeMs > entry.data.timestamp) {
        return false
      }
    }
    return true
  }
})
```

## 🧹 Cache Invalidation Mechanism

Cache is automatically invalidated in the following scenarios:

### 1. **Time-Based Expiration**
- Based on `ttlDays` configuration setting
- Configurable per cache instance

### 2. **File-Based Invalidation** (for file caching)
- **Modification Time Changed** - Detects file updates
- **File Size Changed** - Detects file modifications
- **Content Hash Changed** - For small files (<50KB), validates content integrity

### 3. **Custom Validation**
- User-defined validation logic via `validator` option
- Allows complex business logic validation

### 4. **Capacity Management**
- Automatic cleanup when `maxFiles` limit is reached
- LRU-style cleanup (oldest files removed first)

## 🔧 Advanced Configuration

### Multi-Environment Setup

```typescript
const env = process.env.NODE_ENV || 'development'

const cache = new Cache<any>({
  cacheDir: path.join(process.cwd(), `.cache/${env}`),
  ttlDays: env === 'production' ? 30 : 1,
  maxFiles: env === 'production' ? 10000 : 1000,
  autoCleanup: true,
})
```

### Performance Monitoring

```typescript
class MonitoredCache<T> extends Cache<T> {
  async get(filePath: string): Promise<T | null> {
    const start = Date.now()
    const result = await super.get(filePath)
    const duration = Date.now() - start
    
    console.log(`Cache ${result ? 'HIT' : 'MISS'} for ${filePath} (${duration}ms)`)
    return result
  }
  
  async getPerformanceReport() {
    const stats = await this.getStats()
    return {
      hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
      totalRequests: stats.hits + stats.misses,
      diskUsage: `${(stats.diskUsage / 1024 / 1024).toFixed(2)}MB`,
      fileCount: stats.files,
    }
  }
}
```

### Distributed Caching Setup

```typescript
import Redis from 'ioredis'

class DistributedCache<T> extends Cache<T> {
  private redis: Redis
  
  constructor(options: CacheOptions<T> & { redis: Redis.RedisOptions }) {
    super(options)
    this.redis = new Redis(options.redis)
  }
  
  async get(filePath: string): Promise<T | null> {
    // Try local cache first
    let result = await super.get(filePath)
    
    if (!result) {
      // Try distributed cache
      const redisData = await this.redis.get(`cache:${filePath}`)
      if (redisData) {
        result = JSON.parse(redisData)
        // Populate local cache
        await super.set(filePath, result)
      }\n    }\n    \n    return result\n  }\n  \n  async set(filePath: string, data: T): Promise<void> {\n    // Set in both local and distributed cache\n    await super.set(filePath, data)\n    await this.redis.setex(`cache:${filePath}`, this.options.ttlDays * 86400, JSON.stringify(data))\n  }\n}\n```

## 🌍 Environment Variables

```bash\n# Set global cache directory\nexport CACHE_DIR=\"/path/to/cache\"\n\n# Enable debug logging\nexport DEBUG=\"@eljs/cache\"\n\n# Set cache TTL (days)\nexport CACHE_TTL_DAYS=\"7\"\n```

## ❗ Error Handling

```typescript
try {\n  const data = await cache.get('./config.json')\n  if (!data) {\n    console.log('Cache miss - loading from source')\n  }\n} catch (error) {\n  console.error('Cache operation failed:', error.message)\n  // Fallback to direct file loading\n}\n```

## 🛠️ Development & Debugging

```typescript\n// Enable verbose logging\nprocess.env.DEBUG = '@eljs/cache'\n\n// Monitor cache performance\nconst cache = new Cache({ enabled: true })\n\n// Check initialization status\nconsole.log('Cache initialized:', cache.initialized)\n\n// Get detailed statistics\nconst stats = await cache.getStats()\nconsole.log('Cache stats:', stats)\n\n// Perform manual cleanup\nconst cleanupResult = await cache.cleanup()\nconsole.log('Cleanup result:', cleanupResult)\n```

## 🤝 Compatibility

- **Node.js**: >= 16.20.0\n- **TypeScript**: >= 5.0.0 (optional, but recommended)\n\n## 📄 License\n\n[MIT](https://github.com/chnliquan/eljs/blob/master/LICENSE) © liquan\n\n## 🔗 Related Links\n\n- [GitHub Repository](https://github.com/chnliquan/eljs/tree/master/packages/cache)\n- [Issue Tracker](https://github.com/chnliquan/eljs/issues)\n- [Changelog](https://github.com/chnliquan/eljs/blob/master/packages/cache/CHANGELOG.md)\n\n---\n\n**@eljs/cache** is part of the [eljs](https://github.com/chnliquan/eljs) toolchain
