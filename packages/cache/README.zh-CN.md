# @eljs/cache

[English](./README.md)

面向 Node.js 工具的内存缓存，支持磁盘持久化、TTL 校验和文件失效检测。

[![NPM Version](https://img.shields.io/npm/v/@eljs/cache.svg)](https://www.npmjs.com/package/@eljs/cache)
[![NPM Downloads](https://img.shields.io/npm/dm/@eljs/cache.svg)](https://www.npmjs.com/package/@eljs/cache)
[![License](https://img.shields.io/npm/l/@eljs/cache.svg)](https://github.com/chnliquan/eljs/blob/master/LICENSE)

## ✨ 特性

- **内存与磁盘缓存** - 通过磁盘持久化支持内存中的 LRU 条目
- **TTL 与文件校验** - 检查过期时间，并检查文件大小以及内容哈希或修改时间
- **容量清理** - 启动时清理，并尽力满足磁盘限制，同时对内存条目数量施加硬性限制
- **TypeScript 泛型** - 为缓存值和自定义回调提供类型支持
- **统计信息** - 命中率、缓存文件数量和磁盘使用量
- **自定义能力** - 键生成、序列化和校验
- **原子持久化** - 原子磁盘写入和带版本的缓存文件

## 📦 安装

```bash
# 使用 pnpm（推荐）
pnpm add @eljs/cache

# 使用 yarn
yarn add @eljs/cache

# 使用 npm
npm install @eljs/cache -S
```

## 🚀 快速开始

### 基本用法

```typescript
import { Cache } from '@eljs/cache'

// 创建缓存实例
const cache = new Cache<string>()

// 基于文件的缓存
await cache.set('./config.json', 'cached data')
const data = await cache.get('./config.json')

// 基于数据的缓存：setByData 返回生成的键
const key = await cache.setByData('my data')
const result = key ? await cache.getByKey(key) : null
```

### 类型安全缓存（推荐）

```typescript
interface UserData {
  id: string
  name: string
  email: string
  lastUpdated: number
}

// 创建带类型的缓存实例
const userCache = new Cache<UserData>({
  cacheDir: './user-cache',
  ttlDays: 1,
})

// 类型安全的操作
const userData: UserData = {
  id: '123',
  name: 'John Doe',
  email: 'john@example.com',
  lastUpdated: Date.now(),
}

const userKey = await userCache.setByData(userData)
const cachedUser = userKey ? await userCache.getByKey(userKey) : null // 类型：UserData | null
```

## 📖 API 参考

### Cache 构造函数

```typescript
new Cache<T>(options?: CacheOptions<T>)

interface CacheOptions<T> {
  /** 是否启用缓存（默认：true） */
  enabled?: boolean
  /** 缓存目录路径（默认：path.join(process.env.CACHE_DIR || os.tmpdir(), '.eljs-cache')） */
  cacheDir?: string
  /** 以天为单位的正 TTL，须能安全表示为毫秒（默认：7） */
  ttlDays?: number
  /** 是否在启动时自动清理过期文件（默认：true） */
  autoCleanup?: boolean
  /** 尽力满足的磁盘文件数量限制和内存 LRU 条目数量硬性限制（默认：1000） */
  maxFiles?: number
  /** 完整持久化 JSON 条目及内存准入的 UTF-8 字节限制（默认：16MiB） */
  maxEntryBytes?: number
  /** 受管理缓存文件的总字节限制（默认：256MiB） */
  maxDiskBytes?: number
  /** 用于数据持久化的自定义序列化器 */
  serializer?: CacheSerializer<T>
  /** 自定义键生成函数 */
  keyGenerator?: CacheKeyGenerator<T>
  /** 用于缓存校验的自定义校验器 */
  validator?: CacheValidator<T>
}
```

### 基于文件的缓存方法

#### `get()` - 按文件路径获取缓存数据

```typescript
async get(filePath: string): Promise<T | null>
```

**特性：**

- 始终校验 TTL 和文件大小；小于 50KiB 的文件使用内容哈希，大于或等于 50KiB 的文件使用精确修改时间
- 缓存过期、无效或不存在时返回 `null`
- 同时支持内存和磁盘缓存层

**示例：**

```typescript
const config = await cache.get('./app.config.json')
if (config) {
  console.log('Cache hit:', config)
} else {
  console.log('Cache miss - need to load from source')
}
```

#### `set()` - 为文件路径设置缓存数据

```typescript
async set(filePath: string, data: T): Promise<void>
```

缓存与特定文件路径关联的数据，并包含用于校验的文件元数据。

### 基于数据的缓存方法

#### `getByKey()` - 按键获取缓存数据

```typescript
async getByKey(key: string): Promise<T | null>
```

#### `setByData()` - 缓存任意数据

```typescript
async setByData(
  data: T,
  metadata?: { timestamp?: number },
): Promise<string | null>
```

**示例：**

```typescript
// 缓存任意数据并保留生成的键
const key = await cache.setByData({ userId: '123', preferences: {...} })

// 使用 setByData 返回的原始键读取
const cachedData = key ? await cache.getByKey(key) : null
```

### 缓存管理方法

#### `getStats()` - 获取缓存统计信息

```typescript
async getStats(): Promise<CacheStats>

interface CacheStats {
  hits: number        // 缓存命中次数
  misses: number      // 缓存未命中次数
  files: number       // 缓存文件数量
  hitRate: number     // 命中率（0-1）
  diskUsage: number   // 磁盘使用量，单位为字节
}
```

**示例：**

```typescript
const stats = await cache.getStats()
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`)
console.log(`Disk usage: ${(stats.diskUsage / 1024 / 1024).toFixed(2)}MB`)
```

#### `cleanup()` - 清理过期缓存

```typescript
async cleanup(): Promise<CleanupResult>

interface CleanupResult {
  removed: number      // 已删除的缓存文件和过期原子写入临时文件数量
  totalSize: number    // 释放的空间，单位为字节
  errors: string[]     // 错误消息
}
```

#### `clear()` - 清空所有缓存

```typescript
async clear(): Promise<void>
```

清空内存、受管理的磁盘缓存文件和原子写入临时文件。
缓存目录中的其他文件保持不变。

## 🎯 自定义

### 自定义键生成器

```typescript
const cache = new Cache<UserData>({
  keyGenerator: user => {
    // 根据用户数据生成唯一键
    return `user-${user.id}-${user.email}`
  },
})
```

### 自定义序列化器

```typescript
import { deflateSync, inflateSync } from 'node:zlib'

const cache = new Cache<Record<string, unknown>>({
  serializer: {
    serialize: data => {
      // 保存前压缩数据
      const json = JSON.stringify(data)
      return deflateSync(json).toString('base64')
    },
    deserialize: compressed => {
      if (typeof compressed !== 'string') {
        throw new TypeError('Expected a base64 string')
      }

      // 加载后解压数据
      const buffer = Buffer.from(compressed, 'base64')
      const json = inflateSync(buffer).toString()
      return JSON.parse(json) as Record<string, unknown>
    },
  },
})
```

### 自定义校验器

```typescript
const cache = new Cache<ApiResponse>({
  validator: async (entry, filePath) => {
    // 自定义校验逻辑
    const isRecent = Date.now() - entry.timestamp < 3600000 // 1 小时
    const hasValidData = entry.data && entry.data.status === 'success'
    return isRecent && hasValidData
  },
})
```

校验器接收只读的条目快照，应保持无副作用。
不要在校验器内部等待同一个 `Cache` 实例上的另一项缓存操作，
因为同键操作和全局清理会按设计有序执行。

## 持久化与一致性

- 缓存文件使用带版本的 JSON 封装，并通过原子重命名发布。读取方不会读取到仅写入部分内容的 JSON 文件。
- 将 `cacheDir` 视为所有权边界：一个目录应仅服务于一种数据类型、一种序列化器契约和一个缓存生产方。`clear()` 和 `cleanup()` 会删除符合缓存命名协议的文件，因此不要在该目录中混入无关文件。
- 清理会删除超过 24 小时的原子写入临时文件，并保留较新的临时文件；`clear()` 会立即删除受管理的缓存文件和临时文件。
- `false`、`0`、空字符串、`null` 和 `undefined` 在进程重启后仍会保留。当 `T` 包含 `null` 时，如果应用必须区分已缓存的 `null` 与未命中，请使用命中统计或领域封装。
- 默认缓存目录为 `path.join(process.env.CACHE_DIR || os.tmpdir(), '.eljs-cache')`。设置 `cacheDir` 可覆盖默认值。
- 文件路径会规范化为绝对路径。所有基于文件的条目都会检查 TTL 和文件大小。小于 50KiB（51,200 字节）的文件还会使用内容哈希；大于或等于 50KiB 的文件还会使用精确修改时间。
- TTL 按条目存储。修改 `ttlDays` 只影响新写入，不会改写已有条目的生命周期。配置必须能转换为不大于 `Number.MAX_SAFE_INTEGER` 的正毫秒值。
- 同一个 `Cache` 实例内，对同一个键的读写按序执行。原子重命名可防止跨进程读取到部分文件，但清理和发布在其他方面只能尽力保证：没有分布式锁，并发清理可能将刚发布的条目变成缓存未命中。
- 持久化尽力而为。磁盘写入失败后，通过容量准入的条目仍可在内存中使用，但受 TTL 和 LRU 淘汰约束。
- 默认序列化器面向 JSON 兼容值。对于 `Date`、`Map`、类实例、`BigInt` 或其他需要显式重建的值，请使用自定义序列化器。
- 默认数据键对带类型标记的规范表示计算 SHA-256。基本类型之间保持区分，普通对象的属性插入顺序不影响键。函数、symbol、循环引用、不支持的非普通对象以及执行失败的 `toJSON` 实现都会被拒绝。对于 `Map`、`Set` 或没有 `toJSON` 的类实例等值，请同时提供自定义序列化器和 `keyGenerator`。
- 始终保留 `setByData` 返回的键。默认键属于实现细节，可能随包版本变化；如果领域键必须在不同实现或部署之间保持稳定，请使用自定义的确定性 `keyGenerator`。

## 容量与内存准入

源路径必须指向普通文件，允许指向普通文件的符号链接。
目录、FIFO、设备和 socket 会在哈希读取前被拒绝：`get()` 返回未命中，
`set()` 放弃准入，并尽力删除同键旧缓存。
小文件哈希使用非阻塞打开，将句柄身份与已观察源状态比对，
只读取观察大小并额外探测一个字节，再复查句柄与路径。
观察期间的替换或修改使操作失效，避免无界读取挂住按键任务和 `clear()`。
源目录及其父目录仍须可信，这不是任意并发修改下的快照保证

`maxEntryBytes` 默认为 `16 * 1024 * 1024`（16MiB），`maxDiskBytes`
默认为 `256 * 1024 * 1024`（256MiB）。这两个选项和 `maxFiles` 都必须为正的安全整数，
且满足 `maxEntryBytes <= maxDiskBytes`。无效配置会在构造时抛出 `RangeError`。

条目大小按完整持久化 JSON 的 UTF-8 字节数计算，包括数据、元数据、转义内容和末尾换行。
每次写入会同步调用自定义 `serialize` 函数一次，并使用同一份文本进行准入判断和原子发布。
过大或无法序列化的条目不会被接纳到内存；同键的旧条目会尽力删除。
`set()` 正常完成，而 `setByData()` 返回 `null`。
普通磁盘写入失败后，已接纳的条目仍可在内存中使用。

磁盘读取不会跟随缓存文件的符号链接。打开文件后，缓存会通过文件句柄验证其身份、
普通文件类型和大小，再执行有界读取，并通过额外读取一个字节检查文件增长。
增长、过大、非普通或损坏的文件会被视为缓存未命中，并尽力删除其受管理路径。
这些检查也适用于旧版 MD5 文件名。迁移复用已序列化的数据，
仅在新文件发布后才删除旧文件；迁移失败时仍可返回旧的缓存值。
请确保缓存目录及其父目录由可信方控制；这些检查不能隔离恶意的目录替换。

初始化和 `getStats()` 使用 `lstat` 扫描受管理路径，不计入符号链接目标。
此后，发布、替换、删除和迁移会以增量方式维护文件数量和字节数。
清理先删除过期、损坏和过大的文件，再按创建时间淘汰最旧的条目，
以同时满足 `maxFiles` 和 `maxDiskBytes`，并删除对应的内存条目。
即使设置 `autoCleanup: false`，显式调用 `cleanup()` 和成功持久化后的容量限制执行仍会运行。
扫描时逐个读取 JSON 文件，并且只保留元数据；删除和文件状态查询最多使用 32 个并发操作。
`clear()` 会重新扫描剩余文件，使删除失败的文件仍计入容量统计。

磁盘字节限制覆盖受管理的缓存文件，不包括原子写入临时文件和无关文件。
并发发布可能暂时超出限制；每次完成写入后最多执行三轮清理。
外部写入方和删除失败使磁盘容量只能尽力收敛。
`maxFiles` 限制内存 LRU 条目数量，`maxEntryBytes` 按持久化大小限制准入。
`maxDiskBytes` 不限制总内存使用量。这些选项不会对 JavaScript 堆施加硬性限制：
输入值、JSON 文本和解析后的对象仍需要分配内存，自定义反序列化器也可能将小文件展开为大对象。

## 运行环境要求

- Node.js 22.14 或更新版本
- 无运行时包依赖

## 开发

```bash
# 运行一次此包的测试
pnpm --filter @eljs/cache test

# 以监听模式运行此包的测试
pnpm --filter @eljs/cache test:watch

# 使用仓库阈值运行包范围的覆盖率检查
pnpm --filter @eljs/cache test:coverage

# 检查此包的源码和测试
pnpm --filter @eljs/cache lint

# 对源码和测试进行类型检查
pnpm --filter @eljs/cache typecheck
```
