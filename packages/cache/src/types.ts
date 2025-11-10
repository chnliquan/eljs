/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 缓存构造函数选项
 */
export interface CacheOptions<T> {
  /**
   * 是否启用缓存
   * @default true
   */
  enabled?: boolean
  /**
   * 缓存目录路径
   * @default os.tmpdir() + '/.eljs-cache'
   */
  cacheDir?: string
  /**
   * 缓存存活时间（天数）
   * @default 7
   */
  ttlDays?: number
  /**
   * 启动时是否自动清理过期文件
   * @default true
   */
  autoCleanup?: boolean
  /**
   * 最大缓存文件数量
   * @default 1000
   */
  maxFiles?: number
  /**
   * 用于数据持久化的自定义序列化器
   */
  serializer?: CacheSerializer<T>
  /**
   * 自定义键生成函数
   */
  keyGenerator?: CacheKeyGenerator<T>
  /**
   * 用于缓存验证的自定义验证器
   */
  validator?: CacheValidator<T>
}

/**
 * 缓存条目
 */
export interface CacheEntry<T = any> {
  /**
   * 缓存的数据实例
   */
  data: T
  /**
   * 创建时间戳
   */
  timestamp: number
  /**
   * 文件修改时间戳
   */
  mtime: number
  /**
   * 文件大小
   */
  size: number
  /**
   * 文件内容哈希值
   */
  hash: string
  /**
   * 缓存键
   */
  key: string
}

/**
 * 磁盘缓存文件格式
 */
export interface CacheFile<T = any> {
  /**
   * 缓存格式版本
   */
  version: string
  /**
   * 缓存的数据
   */
  data: T
  /**
   * 缓存元数据
   */
  metadata: {
    timestamp: number
    mtime: number
    size: number
    hash: string
    ttl: number
    key: string
  }
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  /**
   * 缓存命中次数
   */
  hits: number
  /**
   * 缓存未命中次数
   */
  misses: number
  /**
   * 缓存文件数量
   */
  files: number
  /**
   * 命中率 (0-1)
   */
  hitRate: number
  /**
   * 磁盘使用量（字节）
   */
  diskUsage: number
}

/**
 * 缓存清理结果
 */
export interface CleanupResult {
  /**
   * 删除的文件数量
   */
  removed: number
  /**
   * 释放的总空间大小（字节）
   */
  totalSize: number
  /**
   * 错误消息列表
   */
  errors: string[]
}

/**
 * 缓存键生成器函数类型
 */
export interface CacheKeyGenerator<T = any> {
  (data: T): string
}

/**
 * 缓存数据序列化器函数类型
 */
export interface CacheSerializer<T = any> {
  serialize: (data: T) => any
  deserialize: (data: any) => T
}

/**
 * 缓存验证器函数类型
 */
export interface CacheValidator<T = any> {
  (entry: CacheEntry<T>, filePath: string): Promise<boolean> | boolean
}
