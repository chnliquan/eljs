/**
 * 缓存构造函数选项
 *
 * @remarks
 * `ttlDays` 必须能安全转换为不超过 `Number.MAX_SAFE_INTEGER` 的正毫秒数
 * `maxFiles`、`maxEntryBytes` 和 `maxDiskBytes` 必须是正安全整数，且单条上限不能超过磁盘总上限
 * 自定义序列化器的输出必须可由 JSON 安全持久化
 *
 * @typeParam T - 缓存中的业务数据类型
 */
export interface CacheOptions<T = unknown> {
  /**
   * 是否启用缓存
   * @defaultValue true
   */
  enabled?: boolean
  /**
   * 缓存目录路径
   *
   * @remarks
   * 目录应由当前缓存用途独占；不同数据类型、序列化协议或生产者应使用不同目录
   * `clear` 和 `cleanup` 会删除其中符合缓存文件命名协议的文件
   *
   * @defaultValue os.tmpdir() + '/.eljs-cache'
   */
  cacheDir?: string
  /**
   * 缓存存活时间（天数）
   *
   * @remarks
   * 构造时转换为至少 1 毫秒的整数，超过 JavaScript 安全整数范围时拒绝配置
   *
   * @defaultValue 7
   */
  ttlDays?: number
  /**
   * 启动时是否自动清理过期文件
   * @defaultValue true
   */
  autoCleanup?: boolean
  /**
   * 最大缓存文件数量
   *
   * @remarks
   * 同时作为单实例内存缓存的条目上限，达到上限后优先淘汰最久未访问的条目
   *
   * @defaultValue 1000
   */
  maxFiles?: number
  /**
   * 单个完整持久化 JSON 文件的最大 UTF-8 字节数，包含元数据和末尾换行
   *
   * @remarks
   * 同时作为内存条目的准入门槛，超限写入会删除同键旧缓存且不进入内存
   * 磁盘读取先检查普通文件类型和大小，再有界读取，拒绝符号链接与超限文件
   * 此值不限制业务对象、序列化过程或反序列化后对象的实际堆内存大小
   *
   * @defaultValue 16777216
   */
  maxEntryBytes?: number
  /**
   * 受管理正式缓存文件的总字节上限
   *
   * @remarks
   * 成功持久化后和显式清理时，与 `maxFiles` 一起按条目创建时间最旧优先淘汰
   * 不包含原子写临时文件和无关文件，不作为内存总字节上限
   * 并发发布、外部写入或删除失败时可能暂时超限，按 best-effort 语义有限重试收敛
   *
   * @defaultValue 268435456
   */
  maxDiskBytes?: number
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
 *
 * @typeParam T - 缓存中的业务数据类型
 */
export interface CacheEntry<T = unknown> {
  /**
   * 缓存的数据实例
   */
  data: T
  /**
   * 创建时间戳，以毫秒表示的非负安全整数
   */
  timestamp: number
  /**
   * 该条目独立的存活时间，以毫秒表示的正安全整数
   */
  ttl: number
  /**
   * 文件修改时间戳
   */
  mtime: number
  /**
   * 文件大小，以字节表示的非负安全整数
   */
  size: number
  /**
   * 文件内容 SHA-256 哈希值，未计算时为空字符串
   */
  hash: string
  /**
   * 缓存键
   */
  key: string
}

/**
 * 磁盘缓存文件格式
 *
 * @remarks
 * 该结构是跨进程和跨版本持久化的兼容性契约，读取方必须先进行运行时校验
 * `dataUndefined` 用于区分被显式缓存的 `undefined` 与缺失的 `data` 字段
 *
 * @typeParam T - 序列化后的数据类型
 */
export interface CacheFile<T = unknown> {
  /**
   * 缓存格式版本
   */
  version: '2.0'
  /**
   * 缓存的数据
   */
  data: T
  /**
   * 缓存元数据
   */
  metadata: {
    /**
     * 条目创建时间戳，以毫秒表示的非负安全整数
     */
    timestamp: number
    /**
     * 关联源文件的修改时间戳，非文件缓存使用写入时间
     */
    mtime: number
    /**
     * 关联源文件的字节数，以非负安全整数表示，非文件缓存为零
     */
    size: number
    /**
     * 小文件内容 SHA-256 哈希，非文件缓存和大文件为空字符串
     */
    hash: string
    /**
     * 该条目独立的存活时间，以毫秒表示的正安全整数
     */
    ttl: number
    /**
     * 未哈希的逻辑缓存键，用于预加载和内存同步
     */
    key: string
    /**
     * 序列化结果是否为 `undefined`
     *
     * @defaultValue false
     */
    dataUndefined?: boolean
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
   * 当前磁盘上受管理的缓存文件数量
   */
  files: number
  /**
   * 命中率 (0-1)
   */
  hitRate: number
  /**
   * 当前磁盘上受管理缓存文件的总字节数
   */
  diskUsage: number
}

/**
 * 缓存清理结果
 */
export interface CleanupResult {
  /**
   * 删除的正式缓存文件和过旧原子写临时文件总数
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
 *
 * @remarks
 * 实现必须同步、确定且返回非空字符串，同一业务数据应始终生成同一个键
 *
 * @typeParam T - 用于生成键的数据类型
 */
export interface CacheKeyGenerator<T = unknown> {
  (data: T): string
}

/**
 * 缓存数据序列化器函数类型
 *
 * @remarks
 * `serialize` 的返回值必须可由 JSON 持久化，`deserialize` 应当把不可信的磁盘数据视为 `unknown`
 * 两个函数都应保持同步且不修改传入数据
 *
 * @typeParam T - 缓存中的业务数据类型
 */
export interface CacheSerializer<T = unknown> {
  serialize: (data: T) => unknown
  deserialize: (data: unknown) => T
}

/**
 * 缓存验证器函数类型
 *
 * @remarks
 * 验证器接收只读条目快照，应保持无副作用
 * 不要在验证器中等待同一 `Cache` 实例的缓存操作，否则可能与按键顺序或全局清理队列互相等待
 *
 * @typeParam T - 缓存中的业务数据类型
 */
export interface CacheValidator<T = unknown> {
  (entry: Readonly<CacheEntry<T>>, filePath: string): Promise<boolean> | boolean
}
