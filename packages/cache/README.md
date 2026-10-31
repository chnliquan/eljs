# @eljs/cache

[简体中文](./README.zh-CN.md)

In-memory caching with disk persistence, TTL validation, and file invalidation for Node.js tools.

[![NPM Version](https://img.shields.io/npm/v/@eljs/cache.svg)](https://www.npmjs.com/package/@eljs/cache)
[![NPM Downloads](https://img.shields.io/npm/dm/@eljs/cache.svg)](https://www.npmjs.com/package/@eljs/cache)
[![License](https://img.shields.io/npm/l/@eljs/cache.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## ✨ Features

- **Memory and disk caching** - In-memory LRU entries backed by disk persistence
- **TTL and file validation** - Expiration checks plus file size and content hash or modification time checks
- **Capacity cleanup** - Startup cleanup and best-effort disk limits, with a hard in-memory entry-count limit
- **TypeScript generics** - Typed cached values and customization callbacks
- **Statistics** - Hit rate, cache file count, and disk usage
- **Customization** - Key generation, serialization, and validation
- **Atomic persistence** - Atomic disk writes and versioned cache files

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
  /** Cache directory path (default: path.join(process.env.CACHE_DIR || os.tmpdir(), '.eljs-cache')) */
  cacheDir?: string
  /** Positive TTL in days, safely representable in milliseconds (default: 7) */
  ttlDays?: number
  /** Whether to automatically clean up expired files on startup (default: true) */
  autoCleanup?: boolean
  /** Best-effort disk file limit and hard in-memory LRU entry limit (default: 1000) */
  maxFiles?: number
  /** UTF-8 byte limit for a complete persisted JSON entry and memory admission (default: 16MiB) */
  maxEntryBytes?: number
  /** Total byte limit for managed cache files (default: 256MiB) */
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

- Always validates TTL and file size; files smaller than 50KiB use a content hash, while files at least 50KiB use exact modification time
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
- The default cache directory is `path.join(process.env.CACHE_DIR || os.tmpdir(), '.eljs-cache')`. Set `cacheDir` to override it.
- File paths are normalized to absolute paths. All file-based entries are checked for TTL and file size. Files smaller than 50KiB (51,200 bytes) additionally use a content hash; files at least 50KiB additionally use exact modification time.
- Source paths must resolve to regular files; symbolic links to regular files are allowed. Directories, FIFOs, devices, and sockets are rejected before hashing: `get()` returns a miss and `set()` skips admission, with best-effort removal of older entries. Small-file hashing opens nonblocking, checks handle identity against the observed source, reads only the observed size plus a one-byte growth probe, and rechecks the handle and path. Replacement or mutation during that observation invalidates the operation without an unbounded read that could block `clear()`. Keep source directories and their parents trusted; this is not a snapshot guarantee against arbitrary concurrent changes.
- TTL is stored per entry. Changing `ttlDays` affects new writes and does not rewrite the lifetime of existing entries. Configuration must convert to a positive millisecond value no greater than `Number.MAX_SAFE_INTEGER`.
- Reads and writes to the same key are ordered within one `Cache` instance. Atomic rename prevents partial files across processes, but cleanup and publication are otherwise best effort: there is no distributed lock, and a concurrent cleanup can turn a newly published entry into a cache miss.
- Persistence is best effort. A capacity-admitted entry remains available in memory after a disk write failure, subject to TTL and LRU eviction.
- The default serializer is intended for JSON-compatible values. Use a custom serializer for `Date`, `Map`, class instances, `BigInt`, or other values that need explicit reconstruction.
- The default data key uses SHA-256 over a type-tagged canonical representation. Primitive types remain distinct, and plain-object property insertion order does not affect the key. Functions, symbols, circular references, unsupported non-plain objects, and failing `toJSON` implementations are rejected. Provide both a custom serializer and `keyGenerator` for values such as `Map`, `Set`, or class instances without `toJSON`.
- Always retain the key returned by `setByData`. The default key is an implementation detail and can change between package versions; use a custom deterministic `keyGenerator` when a domain key must remain stable across implementations or deployments.

## Capacity and Memory Admission

`maxEntryBytes` defaults to `16 * 1024 * 1024` (16MiB), and `maxDiskBytes`
defaults to `256 * 1024 * 1024` (256MiB). Both options and `maxFiles` must be
positive safe integers, with `maxEntryBytes <= maxDiskBytes`. Invalid
configuration throws `RangeError` during construction.

Entry size is measured in UTF-8 bytes for the complete persisted JSON,
including data, metadata, escaping, and the trailing newline. Each write
calls the custom `serialize` function once, synchronously, and uses the same
text for admission and atomic publication. Oversized or unserializable entries
are not admitted to memory; an older entry with the same key is removed on a
best-effort basis. `set()` completes normally, while `setByData()` returns
`null`. An admitted entry remains available in memory after an ordinary disk
write failure.

Disk reads do not follow cache-file symbolic links. After opening a file, the
cache verifies its identity, regular-file type, and size through the file
handle, then performs a bounded read with an extra-byte growth check. Growing,
oversized, non-regular, or corrupt files become cache misses and their managed
paths are removed on a best-effort basis. These checks also apply to legacy
MD5 filenames. Migration reuses serialized data and removes the old file only
after the new file is published; failed migration can still return the old
cached value. Keep the cache directory and its parents under trusted control;
these checks do not isolate malicious directory replacement.

Initialization and `getStats()` scan managed paths with `lstat` without
counting symbolic-link targets. Publication, replacement, deletion, and
migration then maintain file and byte counts incrementally. Cleanup first
removes expired, corrupt, and oversized files, then evicts the oldest entries
by creation time to satisfy both `maxFiles` and `maxDiskBytes`, removing their
in-memory entries as well. Explicit `cleanup()` and capacity enforcement after
successful persistence still run when `autoCleanup: false`. JSON files are
read one at a time and only metadata is retained during scans; deletion and
file-stat operations use at most 32 concurrent operations. `clear()` rescans
the remaining files so failed deletions remain included in capacity statistics.

The disk byte limit covers managed cache files, excluding atomic-write
temporary files and unrelated files. Concurrent publication can temporarily
exceed limits; each completed write performs at most three cleanup rounds.
External writers and deletion failures make disk convergence best effort.
`maxFiles` limits in-memory LRU entry count, and `maxEntryBytes` limits admission
by persisted size. `maxDiskBytes` does not limit total memory usage. These
options do not impose a hard JavaScript heap limit: input values, JSON text,
and parsed objects still require allocation, and a custom deserializer can
expand a small file into a large object.

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
