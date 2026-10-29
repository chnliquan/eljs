# @eljs/cache

Persistent memory-and-disk caching for Node.js tools with TTL validation,
atomic persistence, file invalidation, and bounded cleanup.

[![NPM Version](https://img.shields.io/npm/v/@eljs/cache.svg)](https://www.npmjs.com/package/@eljs/cache)
[![NPM Downloads](https://img.shields.io/npm/dm/@eljs/cache.svg)](https://www.npmjs.com/package/@eljs/cache)
[![License](https://img.shields.io/npm/l/@eljs/cache.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## ✨ Features

- 🚀 **Zero Configuration** - Works out of the box with sensible defaults
- ⚡ **High Performance** - Memory LRU + disk dual-layer caching
- 🧹 **Smart Cleanup** - Continuous file-count limits and startup cleanup
- 🔒 **Type Safety** - Full TypeScript support with generics
- 📊 **Observable** - Built-in hit-rate and disk-usage statistics
- 🎯 **Flexible** - Customizable key generation, serialization, and validation
- 🛡️ **Robust** - Atomic disk writes, version validation, and safe cache invalidation

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

// Data-based caching: setByData returns the generated key
const key = await cache.setByData('my data')
const result = key ? await cache.getByKey(key) : null
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

const userKey = await userCache.setByData(userData)
const cachedUser = userKey ? await userCache.getByKey(userKey) : null // Type: UserData | null
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
  /** Positive TTL in days, safely representable in milliseconds (default: 7) */
  ttlDays?: number
  /** Whether to automatically clean up expired files on startup (default: true) */
  autoCleanup?: boolean
  /** Maximum disk files and in-memory LRU entries (default: 1000) */
  maxFiles?: number
  /** 单个完整持久化 JSON 的 UTF-8 字节上限，同时用于内存准入（默认 16MiB） */
  maxEntryBytes?: number
  /** 受管理正式缓存文件总字节上限（默认 256MiB） */
  maxDiskBytes?: number
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
async setByData(
  data: T,
  metadata?: { timestamp?: number },
): Promise<string | null>
```

**Example:**

```typescript
// Cache arbitrary data and retain the generated key
const key = await cache.setByData({ userId: '123', preferences: {...} })

// Read with exactly the key returned by setByData
const cachedData = key ? await cache.getByKey(key) : null
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
  removed: number      // Cache and stale atomic temporary files removed
  totalSize: number    // Space freed in bytes
  errors: string[]     // Error messages
}
```

#### `clear()` - Clear All Cache

```typescript
async clear(): Promise<void>
```

Clears memory, managed disk cache files, and atomic-write temporary files. Other
files in the cache directory are left untouched.

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
import { deflateSync, inflateSync } from 'node:zlib'

const cache = new Cache<Record<string, unknown>>({
  serializer: {
    serialize: data => {
      // Compress data before saving
      const json = JSON.stringify(data)
      return deflateSync(json).toString('base64')
    },
    deserialize: compressed => {
      if (typeof compressed !== 'string') {
        throw new TypeError('Expected a base64 string')
      }

      // Decompress data after loading
      const buffer = Buffer.from(compressed, 'base64')
      const json = inflateSync(buffer).toString()
      return JSON.parse(json) as Record<string, unknown>
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

Validators receive a read-only entry snapshot and should remain side-effect
free. Do not await another cache operation on the same `Cache` instance from
inside a validator, because same-key operations and global cleanup are
intentionally ordered.

## Persistence and Consistency

- Cache files use a versioned JSON envelope and are published with an atomic rename. Readers never consume a partially written JSON file.
- Treat `cacheDir` as an ownership boundary: one directory should serve only one data type, serializer contract, and cache producer. `clear()` and `cleanup()` remove files matching the cache naming protocol, so do not mix unrelated files into that directory.
- Cleanup removes atomic-write temporary files older than 24 hours and leaves newer temporary files alone; `clear()` removes both managed cache and temporary files immediately.
- `false`, `0`, empty strings, `null`, and `undefined` are preserved across process restarts. When `T` includes `null`, use hit statistics or a domain wrapper if your application must distinguish a cached `null` from a miss.
- File paths are normalized to absolute paths. Files smaller than 50KB are validated by content hash; larger files are validated by size and exact modification time.
- TTL is stored per entry. Changing `ttlDays` affects new writes and does not rewrite the lifetime of existing entries. Configuration must convert to a positive millisecond value no greater than `Number.MAX_SAFE_INTEGER`.
- Reads and writes to the same key are ordered within one `Cache` instance. Atomic rename prevents partial files across processes, but cleanup and publication are otherwise best effort: there is no distributed lock, and a concurrent cleanup can turn a newly published entry into a cache miss.
- Persistence is best effort. A capacity-admitted entry remains available in memory after a disk write failure, subject to TTL and LRU eviction.
- The default serializer is intended for JSON-compatible values. Use a custom serializer for `Date`, `Map`, class instances, `BigInt`, or other values that need explicit reconstruction.
- The default data key uses SHA-256 over a type-tagged canonical representation. Primitive types remain distinct, and plain-object property insertion order does not affect the key. Functions, symbols, circular references, unsupported non-plain objects, and failing `toJSON` implementations are rejected. Provide both a custom serializer and `keyGenerator` for values such as `Map`, `Set`, or class instances without `toJSON`.
- Always retain the key returned by `setByData`. The default key is an implementation detail and can change between package versions; use a custom deterministic `keyGenerator` when a domain key must remain stable across implementations or deployments.

## 容量与内存准入

`maxEntryBytes` 默认 `16 * 1024 * 1024`（16MiB），`maxDiskBytes` 默认
`256 * 1024 * 1024`（256MiB）。两者与 `maxFiles` 都必须是正安全整数，
且 `maxEntryBytes <= maxDiskBytes`；不合法配置在构造时抛出 `RangeError`。

单条容量按实际持久化的完整 JSON 文本计算 UTF-8 字节数，包含业务数据、
元数据、JSON 转义和末尾换行；多字节字符不能按 JavaScript 字符串长度估算。
每次写入同步调用一次自定义 `serialize`，生成的同一份文本用于准入和原子发布。
超限或序列化失败的条目不进入内存，并尽力删除同键旧缓存，避免读取旧值；
`set()` 正常结束，`setByData()` 返回 `null`。合规条目发生普通磁盘写入失败时，
仍保留内存命中能力。

磁盘读取不跟随缓存文件符号链接，打开后通过文件句柄检查文件身份、
普通文件类型和大小，再按检查时的大小有界读取并探测额外一个字节。
检查后增长、超限、非普通文件或损坏文件均按未命中处理，并尽力移除受管理路径。
这些检查适用于当前格式和历史 MD5 文件名；迁移复用原始序列化数据，不再次调用
自定义序列化器，只有新文件发布成功后才删除旧文件，迁移失败仍可命中旧缓存。
缓存目录及其父目录应由可信调用方控制，这些文件检查不提供恶意目录替换隔离。

初始化扫描和 `getStats()` 统计已有受管理路径的大小（使用 `lstat`，
不累计符号链接目标），后续发布、覆盖、删除和迁移增量维护文件数与字节数。
清理先移除过期、损坏和超限文件，再同时按 `maxFiles` 和 `maxDiskBytes`
淘汰创建时间最旧的条目，并同步移除对应内存条目；显式 `cleanup()` 和成功持久化
后的容量收敛不受 `autoCleanup: false` 影响。JSON 逐个读取，扫描只保留元数据，
避免并发解析多个最大条目；删除和纯文件统计仍使用最多 32 个并发操作。
`clear()` 后重新扫描统计，删除失败时保留残余文件容量。

磁盘总上限只涵盖受管理正式缓存路径，不包含原子写临时文件及无关文件。
原子发布和并发写入可能暂时超限，写入完成后最多执行三轮清理；
外部进程写入或删除失败时仍是 best-effort，无法保证目录在每个瞬间满足限额。
`maxFiles` 限制内存 LRU 条目数，`maxEntryBytes` 限制内存准入所依据的持久化大小；
`maxDiskBytes` 不限制内存总字节数。这些选项不保证 JavaScript 堆内存的硬上限：
序列化之前的数据、JSON 文本和解析对象仍需分配，自定义反序列化器也可能把小文件
扩展成大对象，调用方应自行控制数据大小和反序列化行为。

## Runtime Requirements

- Node.js 22.14 or newer
- No runtime package dependencies

## Development

```bash
# Run this package's tests once
pnpm --filter @eljs/cache test

# Watch this package's tests
pnpm --filter @eljs/cache test:watch

# Run package-scoped coverage with repository thresholds
pnpm --filter @eljs/cache test:coverage

# Check this package's source and tests
pnpm --filter @eljs/cache lint

# Type-check source and tests
pnpm --filter @eljs/cache typecheck
```
