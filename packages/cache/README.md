# @eljs/cache

一个智能、高性能的缓存系统，支持零配置启用和智能清理

## 特性

- 🚀 **零配置** - 开箱即用，具有合理的默认设置
- ⚡ **高性能** - 内存 + 磁盘双层缓存
- 🧹 **智能清理** - 自动清理过期和无效缓存
- 🔒 **类型安全** - 完全的 TypeScript 支持和泛型
- 📊 **可观测** - 内置统计信息和监控
- 🎯 **灵活** - 可自定义键生成、序列化和验证

## 安装

```bash
pnpm add @eljs/cache
```

## 快速开始

```typescript
import { Cache } from '@eljs/cache'

// 创建缓存实例
const cache = new Cache<string>()

// 基于文件的缓存
await cache.set('./config.json', 'cached data')
const data = await cache.get('./config.json')

// 基于数据的缓存
await cache.setByData('my data')
const result = await cache.getByKey('generated-key')
```

## 基础用法

### 文件缓存

```typescript
import { Cache } from '@eljs/cache'

const cache = new Cache<MyDataType>()

// 设置文件缓存
await cache.set('./data.json', myData)

// 获取文件缓存（如果未找到或无效则返回 null）
const cachedData = await cache.get('./data.json')

if (cachedData) {
  console.log('缓存命中!', cachedData)
} else {
  console.log('缓存未命中 - 需要从源加载')
}
```

### 数据缓存

```typescript
// 缓存任意数据
await cache.setByData({ id: '123', name: 'test' })

// 通过键获取数据
const cachedItem = await cache.getByKey('generated-key')
```

## 配置选项

```typescript
import { Cache, CacheOptions } from '@eljs/cache'

const options: CacheOptions<MyDataType> = {
  enabled: true,           // 启用/禁用缓存（默认：true）
  cacheDir: './my-cache',  // 自定义缓存目录（默认：系统临时目录）
  ttlDays: 7,              // 缓存 TTL 天数（默认：7）
  autoCleanup: true,       // 启动时自动清理（默认：true）
  maxFiles: 1000,          // 最大缓存文件数（默认：1000）
}

const cache = new Cache<MyDataType>(options)
```

## 自定义函数

### 自定义键生成器

```typescript
const cache = new Cache<MyData>({
  keyGenerator: (data) => {
    // 根据数据生成唯一键
    return `${data.type}-${data.id}`
  }
})
```

### 自定义序列化器

```typescript
const cache = new Cache<MyData>({
  serializer: {
    serialize: (data) => {
      // 自定义序列化逻辑
      return JSON.stringify(data)
    },
    deserialize: (str) => {
      // 自定义反序列化逻辑
      return JSON.parse(str)
    }
  }
})
```

### 自定义验证器

```typescript
const cache = new Cache<MyData>({
  validator: async (entry, filePath) => {
    // 自定义验证逻辑
    return entry.data.isValid && Date.now() - entry.timestamp < 86400000
  }
})
```

## 缓存管理

### 获取统计信息

```typescript
const stats = await cache.getStats()

console.log({
  hits: stats.hits,                   // 命中次数
  misses: stats.misses,               // 未命中次数
  hitRate: stats.hitRate,             // 命中率 (0-1)
  files: stats.files,                   // 缓存文件数
  diskUsage: stats.diskUsage          // 磁盘使用量（字节）
})

// 格式化显示
console.log(`命中率: ${(stats.hitRate * 100).toFixed(1)}%`)
console.log(`磁盘使用: ${(stats.diskUsage / 1024 / 1024).toFixed(2)}MB`)
```

### 清理过期缓存

```typescript
const cleanupResult = await cache.cleanup()

console.log({
  removed: cleanupResult.removed,      // 删除的文件数
  totalSize: cleanupResult.totalSize,  // 释放的空间（字节）
  errors: cleanupResult.errors         // 错误信息
})
```

### 清空所有缓存

```typescript
// 清空内存和磁盘缓存
await cache.clear()
```

## 完整示例

```typescript
import { Cache, CacheOptions } from '@eljs/cache'

interface UserData {
  id: string
  name: string
  email: string
  lastUpdated: number
}

// 创建用户数据缓存
const userCache = new Cache<UserData>({
  cacheDir: './user-cache',
  ttlDays: 1,
  keyGenerator: (user) => `user-${user.id}`,
  validator: async (entry) => {
    // 验证数据是否过期（1小时）
    return Date.now() - entry.data.lastUpdated < 3600000
  }
})

class UserService {
  async getUser(userId: string): Promise<UserData | null> {
    // 尝试从缓存获取
    let user = await userCache.getByKey(`user-${userId}`)
    
    if (!user) {
      // 缓存未命中，从数据库加载
      user = await this.loadUserFromDatabase(userId)
      
      if (user) {
        // 保存到缓存
        await userCache.setByData(user)
      }
    }
    
    return user
  }
  
  async loadUserFromDatabase(userId: string): Promise<UserData | null> {
    // 模拟数据库查询
    return {
      id: userId,
      name: 'John Doe',
      email: 'john@example.com',
      lastUpdated: Date.now()
    }
  }
  
  async getUserStats() {
    return await userCache.getStats()
  }
}
```

## 缓存失效机制

缓存在以下情况下自动失效：

1. **TTL 过期** - 基于 `ttlDays` 设置
2. **文件修改时间变更** - 检测文件更新
3. **文件大小变更** - 检测文件修改
4. **内容哈希变更** - 针对小文件（<50KB）
5. **自定义验证失败** - 如果自定义验证器返回 false

## 环境变量

```bash
# 设置全局缓存目录
export CACHE_DIR=\"/path/to/cache\"
```

## API 参考

### 构造函数

```typescript
new Cache<T>(options?: CacheOptions<T>)
```

### 主要方法

**文件缓存**

- `get(filePath: string): Promise<T | null>` - 获取文件缓存
- `set(filePath: string, data: T): Promise<void>` - 设置文件缓存

**数据缓存**

- `getByKey(key: string): Promise<T | null>` - 通过键获取缓存
- `setByData(data: T, metadata?: { timestamp?: number }): Promise<void>` - 缓存数据

**管理方法**

- `cleanup(): Promise<CleanupResult>` - 清理过期缓存
- `clear(): Promise<void>` - 清空所有缓存
- `getStats(): Promise<CacheStats>` - 获取统计信息
