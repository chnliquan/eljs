# @eljs/cache

An high-performance caching system with zero-configuration setup and smart cleanup capabilities

## Features

- 🚀 **Zero Configuration** - Works out of the box with sensible defaults
- ⚡ **High Performance** - Memory + disk dual-layer caching
- 🧹 **Smart Cleanup** - Automatic cleanup of expired and invalid caches
- 🔒 **Type Safety** - Full TypeScript support with generics
- 📊 **Observable** - Built-in statistics and monitoring
- 🎯 **Flexible** - Customizable key generation, serialization, and validation

## Installation

```bash
pnpm add @eljs/cache
// or
yarn add @eljs/cache
// or
npm i @eljs/cache -S
```

## Quick Start

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

## Basic Usage

### File Caching

```typescript
import { Cache } from '@eljs/cache'

const cache = new Cache<MyDataType>()

// Set file cache
await cache.set('./data.json', myData)

// Get file cache (returns null if not found or invalid)
const cachedData = await cache.get('./data.json')

if (cachedData) {
  console.log('Cache hit!', cachedData)
} else {
  console.log('Cache miss - need to load from source')
}
```

### Data Caching

```typescript
// Cache arbitrary data
await cache.setByData({ id: '123', name: 'test' })

// Get data by key
const cachedItem = await cache.getByKey('generated-key')
```

## Configuration Options

```typescript
interface CacheOptions<T> {
  /**
   * Whether to enable caching
   * @default true
   */
  enabled?: boolean
  /**
   * Cache directory path
   * @default os.tmpdir() + '/.eljs-cache'
   */
  cacheDir?: string
  /**
   * Cache time-to-live in days
   * @default 7
   */
  ttlDays?: number
  /**
   * Whether to automatically clean up expired files on startup
   * @default true
   */
  autoCleanup?: boolean
  /**
   * Maximum number of cache files
   * @default 1000
   */
  maxFiles?: number
  /**
   * Custom serializer for data persistence
   */
  serializer?: CacheSerializer<T>
  /**
   * Custom key generation function
   */
  keyGenerator?: CacheKeyGenerator<T>
  /**
   * Custom validator for cache validation
   */
  validator?: CacheValidator<T>
}
```

## Custom Functions

### Custom Key Generator

```typescript
const cache = new Cache<MyData>({
  keyGenerator: data => {
    // Generate unique key based on data
    return `${data.type}-${data.id}`
  },
})
```

### Custom Serializer

```typescript
const cache = new Cache<MyData>({
  serializer: {
    serialize: data => {
      // Custom serialization logic
      return JSON.stringify(data)
    },
    deserialize: str => {
      // Custom deserialization logic
      return JSON.parse(str)
    },
  },
})
```

### Custom Validator

```typescript
const cache = new Cache<MyData>({
  validator: async (entry, filePath) => {
    // Custom validation logic
    return entry.data.isValid && Date.now() - entry.timestamp < 86400000
  },
})
```

## Cache Management

### Get Statistics

```typescript
const stats = await cache.getStats()

console.log({
  hits: stats.hits, // Hit count
  misses: stats.misses, // Miss count
  hitRate: stats.hitRate, // Hit rate (0-1)
  files: stats.files, // Number of cache files
  diskUsage: stats.diskUsage, // Disk usage in bytes
})

// Formatted display
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`)
console.log(`Disk usage: ${(stats.diskUsage / 1024 / 1024).toFixed(2)}MB`)
```

### Cleanup Expired Cache

```typescript
const cleanupResult = await cache.cleanup()

console.log({
  removed: cleanupResult.removed, // Number of files removed
  totalSize: cleanupResult.totalSize, // Space freed in bytes
  errors: cleanupResult.errors, // Error messages
})
```

### Clear All Cache

```typescript
// Clear both memory and disk cache
await cache.clear()
```

## Complete Example

```typescript
import { Cache, CacheOptions } from '@eljs/cache'

interface UserData {
  id: string
  name: string
  email: string
  lastUpdated: number
}

// Create user data cache
const userCache = new Cache<UserData>({
  cacheDir: './user-cache',
  ttlDays: 1,
  keyGenerator: user => `user-${user.id}`,
  validator: async entry => {
    // Validate if data is expired (1 hour)
    return Date.now() - entry.data.lastUpdated < 3600000
  },
})

class UserService {
  async getUser(userId: string): Promise<UserData | null> {
    // Try to get from cache first
    let user = await userCache.getByKey(`user-${userId}`)

    if (!user) {
      // Cache miss, load from database
      user = await this.loadUserFromDatabase(userId)

      if (user) {
        // Save to cache
        await userCache.setByData(user)
      }
    }

    return user
  }

  async loadUserFromDatabase(userId: string): Promise<UserData | null> {
    // Simulate database query
    return {
      id: userId,
      name: 'John Doe',
      email: 'john@example.com',
      lastUpdated: Date.now(),
    }
  }

  async getUserStats() {
    return await userCache.getStats()
  }
}
```

## Environment Variables

```bash
# Set global cache directory
export CACHE_DIR="/path/to/cache"
```

## API Reference

### Constructor

```typescript
new Cache<T>(options?: CacheOptions<T>)
```

### Main Methods

**File Caching**

- `get(filePath: string): Promise<T | null>` - Get file cache
- `set(filePath: string, data: T): Promise<void>` - Set file cache

**Data Caching**

- `getByKey(key: string): Promise<T | null>` - Get cache by key
- `setByData(data: T, metadata?: { timestamp?: number }): Promise<void>` - Cache data

**Management Methods**

- `cleanup(): Promise<CleanupResult>` - Clean up expired cache
- `clear(): Promise<void>` - Clear all cache
- `getStats(): Promise<CacheStats>` - Get statistics
