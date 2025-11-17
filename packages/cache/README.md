# @eljs/cache

An intelligent caching system with zero-configuration setup and smart cleanup capabilities.

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
  lastUpdated: Date.now(),
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
  keyGenerator: user => {
    // Generate unique key based on user data
    return `user-${user.id}-${user.email}`
  },
})
```

### Custom Serializer

```typescript
import { deflateSync, inflateSync } from 'zlib'

const cache = new Cache<any>({
  serializer: {
    serialize: data => {
      // Compress data before saving
      const json = JSON.stringify(data)
      return deflateSync(json).toString('base64')
    },
    deserialize: compressed => {
      // Decompress data after loading
      const buffer = Buffer.from(compressed, 'base64')
      const json = inflateSync(buffer).toString()
      return JSON.parse(json)
    },
  },
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
  },
})
```
