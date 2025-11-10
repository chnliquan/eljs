# @eljs/cache

A smart, high-performance caching system with zero-config setup and intelligent cleanup.

## Features

- 🚀 **Zero Configuration** - Works out of the box with sensible defaults
- ⚡ **High Performance** - Memory + disk dual-layer caching
- 🧹 **Smart Cleanup** - Automatic cleanup of expired and invalid cache
- 🔒 **Type Safe** - Full TypeScript support with generics
- 🌐 **Cross-Instance** - Global cache sharing across application instances
- 📊 **Observable** - Built-in statistics and monitoring
- 🎯 **Flexible** - Customizable key generation, serialization, and validation

## Installation

```bash
npm install @eljs/cache
# or
pnpm add @eljs/cache
# or  
yarn add @eljs/cache
```

## Quick Start

```typescript
import { Cache } from '@eljs/cache'

// Create a cache instance with default settings
const cache = new Cache<string>()

// Cache a file-based resource
await cache.set('./config.json', 'cached data')
const data = await cache.get('./config.json')

// Cache by key
await cache.setByData('my data', { timestamp: Date.now() })
const result = await cache.getByKey('generated-key')
```

## Usage

### Basic Caching

```typescript
import { Cache } from '@eljs/cache'

// File-based caching with default settings
const cache = new Cache<MyDataType>()

// Set cache for a file
await cache.set('./data.json', myData)

// Get cache for a file (returns null if not found or invalid)
const cachedData = await cache.get('./data.json')

if (cachedData) {
  console.log('Cache hit!', cachedData)
} else {
  console.log('Cache miss - need to load from source')
}
```

### Configuration

```typescript
// Simple configuration
const cache = new Cache<MyDataType>({
  enabled: true,                    // Enable/disable cache (default: true)
  cacheDir: './my-cache',          // Custom cache directory
  ttlDays: 7,                      // Cache TTL in days (default: 7)
  autoCleanup: true,               // Auto cleanup on startup (default: true)  
  maxFiles: 1000,                  // Max cache files (default: 1000)
})
```

### Custom Functions

```typescript
// Advanced configuration with custom functions
const cache = new Cache<MyData>({
  // Basic options
  ttlDays: 7,
  cacheDir: './cache',
  
  // Custom key generation
  keyGenerator: (data) => data.id,
  
  // Custom serialization
  serializer: {
    serialize: (data) => JSON.stringify(data),
    deserialize: (str) => JSON.parse(str)
  },
  
  // Custom validation
  validator: async (entry, filePath) => {
    // Custom validation logic
    return entry.data.isValid
  }
})
```

## Advanced Usage

### Cache Statistics

```typescript
const stats = await cache.getStats()

console.log({
  hits: stats.hits,
  misses: stats.misses,
  hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
  files: stats.files,
  diskUsage: `${(stats.diskUsage / 1024).toFixed(1)}KB`
})
```

### Cache Management

```typescript
// Manual cleanup
const result = await cache.cleanup()
console.log(`Cleaned ${result.removed} files, freed ${result.totalSize} bytes`)

// Clear all cache
await cache.clear()

// Global operations
const globalStats = await GlobalCacheManager.getInstance().getAllCacheStats()
await GlobalCacheManager.getInstance().cleanupAllCaches()
```

### Environment Variables

```bash
# Set global cache directory
export ELJS_CACHE_DIR="/path/to/cache"
```

## Real-world Example

```typescript
import { GlobalCacheManager } from '@eljs/cache'

// Plugin system with caching
class PluginLoader {
  private cache = GlobalCacheManager.getInstance()
    .getCache('plugins', { ttlDays: 7 })

  async loadPlugin(path: string) {
    // Try cache first
    let plugin = await this.cache.get(path)
    
    if (!plugin) {
      // Cache miss - load from disk
      console.log('Loading plugin from disk:', path)
      plugin = await this.loadFromDisk(path)
      
      // Cache for next time
      await this.cache.set(path, plugin)
    } else {
      console.log('Plugin loaded from cache:', path)
    }
    
    return plugin
  }
  
  async getStats() {
    return await this.cache.getStats()
  }
}

// Usage - each instance shares the same cache
const loader1 = new PluginLoader()
const loader2 = new PluginLoader()

await loader1.loadPlugin('./plugin.js') // Loads from disk
await loader2.loadPlugin('./plugin.js') // Loads from cache!
```

## Performance

Typical performance improvements with caching enabled:

- **Small projects (5-10 files)**: 60-70% faster loading
- **Medium projects (10-20 files)**: 70-80% faster loading  
- **Large projects (20+ files)**: 75-85% faster loading

## Cache Invalidation

Cache is automatically invalidated when:

1. **TTL expires** - Based on `ttlDays` setting
2. **File modification time changes** - Detects file updates
3. **File size changes** - Detects file modifications
4. **Content hash changes** - For small files (<50KB)
5. **Custom validation fails** - If custom validator returns false

## Best Practices

1. **Use appropriate TTL** - Longer for production, shorter for development
2. **Monitor cache stats** - Track hit rates to optimize configuration
3. **Namespace your caches** - Use different namespaces for different data types
4. **Handle cache misses gracefully** - Always have fallback logic
5. **Clean up in CI/CD** - Clear caches in deployment pipelines when needed

## API Reference

### Cache<T>

#### Constructor
```typescript
new Cache<T>(options?: CacheOptions)
```

#### Methods
- `get(filePath: string): Promise<T | null>`
- `set(filePath: string, data: T): Promise<void>`  
- `getByKey(key: string): Promise<T | null>`
- `setByData(data: T, metadata?): Promise<void>`
- `cleanup(): Promise<CleanupResult>`
- `clear(): Promise<void>`
- `getStats(): Promise<CacheStats>`

### GlobalCacheManager

#### Methods
- `static getInstance(): GlobalCacheManager`
- `getCache<T>(namespace: string, options?): Cache<T>`
- `getAllCacheStats(): Promise<Record<string, CacheStats>>`
- `cleanupAllCaches(): Promise<Record<string, CleanupResult>>`
- `clearAllCaches(): Promise<void>`

## License

MIT

## Installation

```bash
$ pnpm add @eljs/cache
// or
$ yarn add @eljs/cache
// or
$ npm i @eljs/cache -S
```

## Usage

```ts
import cache from '@eljs/cache'
```

## API


## Development

```bash
$ pnpm run dev --filter @eljs/cache
// or
$ pnpm -F @eljs/cache run dev
```

## Publish

### 1. [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/#summary) 

```bash
$ git commit -m 'feat(cache): add some feature'
$ git commit -m 'fix(cache): fix some bug'
```

### 2. Compile（optional）

```bash
$ pnpm run build --filter @eljs/cache
// or
$ pnpm -F @eljs/cache run build
```

### 3. Release

```bash
$ pnpm run release

Options:
  --skipTests             Skip unit tests.
  --skipBuild             Skip package build.
  --skipRequireClean      Skip git working tree check.
```
