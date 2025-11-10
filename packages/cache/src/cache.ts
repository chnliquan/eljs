import {
  isPathExists,
  isPathExistsSync,
  mkdir,
  readFile,
  remove,
  writeJson,
} from '@eljs/utils'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import type {
  CacheEntry,
  CacheFile,
  CacheKeyGenerator,
  CacheOptions,
  CacheSerializer,
  CacheStats,
  CacheValidator,
  CleanupResult,
} from './types'

/**
 * 缓存类
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class Cache<T = any> {
  /**
   * 构造函数选项
   */
  public constructorOptions: CacheOptions<T>
  /**
   * 缓存配置选项（已解析包含默认值）
   */
  public options: Required<
    Omit<CacheOptions<T>, 'keyGenerator' | 'serializer' | 'validator'>
  >
  /**
   * 缓存目录路径
   */
  public cacheDir: string
  /**
   * 内存缓存存储
   */
  public memoryCache: Map<string, CacheEntry<T>> = new Map()
  /**
   * 缓存统计信息
   */
  public stats: CacheStats = {
    hits: 0,
    misses: 0,
    files: 0,
    hitRate: 0,
    diskUsage: 0,
  }
  /**
   * 初始化状态
   */
  private _initialized = false
  /**
   * 初始化Promise，用于防止重复初始化
   */
  private _initializationPromise: Promise<void> | null = null
  /**
   * 数据序列化器
   */
  private _serializer: CacheSerializer<T>
  /**
   * 键生成器函数
   */
  private _keyGenerator: CacheKeyGenerator<T>
  /**
   * 缓存验证器
   */
  private _validator?: CacheValidator<T>

  /**
   * 缓存是否已初始化
   */
  public get initialized(): boolean {
    return this._initialized
  }

  /**
   * 创建新的缓存实例
   * @param options 缓存配置选项，包括自定义函数
   */
  public constructor(options: CacheOptions<T> = {}) {
    this.constructorOptions = options

    // 使用默认值设置选项（扁平化选项结构）
    this.options = {
      enabled: options.enabled ?? true,
      cacheDir: options.cacheDir ?? this._getDefaultCacheDir(),
      ttlDays: options.ttlDays ?? 7,
      autoCleanup: options.autoCleanup ?? true,
      maxFiles: options.maxFiles ?? 1000,
    }

    this.cacheDir = path.resolve(this.options.cacheDir)

    // 设置自定义函数或使用默认值
    this._serializer = options.serializer ?? this._defaultSerializer
    this._keyGenerator =
      options.keyGenerator ?? this._defaultKeyGenerator.bind(this)
    this._validator = options.validator

    if (this.options.enabled) {
      // 延迟初始化以避免阻塞启动，但缓存Promise以防止重复执行
      this._initializationPromise = this._initializeAsync()
    }
  }

  /**
   * 通过文件路径获取缓存数据
   * @param filePath 要获取缓存的文件路径
   * @returns 缓存的数据，如果未找到或无效则返回 null
   */
  public async get(filePath: string): Promise<T | null> {
    if (!this.options.enabled) {
      return null
    }

    await this._ensureInitialized()

    try {
      // 检查文件是否存在
      if (!(await isPathExists(filePath))) {
        this._recordMiss()
        return null
      }

      const fileStats = await fs.promises.stat(filePath)

      const cacheKey = this._getCacheKey(filePath)
      // 首先检查内存缓存
      let cacheEntry = this.memoryCache.get(cacheKey)

      // 如果不在内存中，尝试从磁盘加载
      if (!cacheEntry) {
        const diskEntry = await this._loadFromDisk(cacheKey)
        if (diskEntry) {
          cacheEntry = diskEntry
          this.memoryCache.set(cacheKey, cacheEntry)
        }
      }

      // 验证缓存
      if (
        cacheEntry &&
        (await this._isCacheValid(cacheEntry, fileStats, filePath))
      ) {
        this._recordHit()
        return cacheEntry.data
      }

      // 缓存无效，清理
      if (cacheEntry) {
        this.memoryCache.delete(cacheKey)
        await this._removeFromDisk(cacheKey)
      }

      this._recordMiss()
      return null
    } catch (error) {
      console.warn(`Failed to get cache for ${filePath}:`, error)
      this._recordMiss()
      return null
    }
  }

  /**
   * 为文件路径设置缓存数据
   * @param filePath 要缓存数据的文件路径
   * @param data 要缓存的数据
   */
  public async set(filePath: string, data: T): Promise<void> {
    if (!this.options.enabled) {
      return
    }

    await this._ensureInitialized()

    try {
      const fileStats = await fs.promises.stat(filePath)
      const fileHash = await this._getFileHash(filePath)

      const cacheKey = this._getCacheKey(filePath)
      const cacheEntry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        mtime: fileStats.mtimeMs,
        size: fileStats.size,
        hash: fileHash,
        key: cacheKey,
      }

      // 保存到内存缓存
      this.memoryCache.set(cacheKey, cacheEntry)

      // 保存到磁盘缓存
      await this._saveToDisk(cacheKey, cacheEntry)

      this._updateStats()
    } catch (error) {
      console.warn(`Failed to cache data for ${filePath}:`, error)
    }
  }

  /**
   * 通过数据设置缓存（非基于文件）
   * @param data 要缓存的数据
   * @param metadata 可选的元数据
   */
  public async setByData(
    data: T,
    metadata?: { timestamp?: number },
  ): Promise<void> {
    if (!this.options.enabled) {
      return
    }

    await this._ensureInitialized()

    const cacheKey = this._keyGenerator(data)

    try {
      const cacheEntry: CacheEntry<T> = {
        data,
        timestamp: metadata?.timestamp ?? Date.now(),
        mtime: Date.now(),
        size: 0,
        hash: '',
        key: cacheKey,
      }

      // 保存到内存缓存
      this.memoryCache.set(cacheKey, cacheEntry)

      // 保存到磁盘缓存
      await this._saveToDisk(cacheKey, cacheEntry)

      this._updateStats()
    } catch (error) {
      console.warn(`Failed to cache data:`, error)
    }
  }

  /**
   * 通过键获取缓存数据
   * @param key 缓存键
   * @returns 缓存的数据，如果未找到或无效则返回 null
   */
  public async getByKey(key: string): Promise<T | null> {
    if (!this.options.enabled) {
      return null
    }

    await this._ensureInitialized()

    try {
      // 首先检查内存缓存
      let cacheEntry = this.memoryCache.get(key)

      // 如果不在内存中，尝试从磁盘加载
      if (!cacheEntry) {
        const diskEntry = await this._loadFromDisk(key)
        if (diskEntry) {
          cacheEntry = diskEntry
          this.memoryCache.set(key, cacheEntry)
        }
      }

      // 验证缓存（基于键的缓存使用时间验证）
      if (cacheEntry && this._isTimeValid(cacheEntry)) {
        this._recordHit()
        return cacheEntry.data
      }

      // 缓存无效，清理
      if (cacheEntry) {
        this.memoryCache.delete(key)
        await this._removeFromDisk(key)
      }

      this._recordMiss()
      return null
    } catch (error) {
      console.warn(`Failed to get cache for key ${key}:`, error)
      this._recordMiss()
      return null
    }
  }

  /**
   * 清理过期和无效的缓存文件
   * @returns 包含统计信息的清理结果
   */
  public async cleanup(): Promise<CleanupResult> {
    const result: CleanupResult = {
      removed: 0,
      totalSize: 0,
      errors: [],
    }

    if (!this.options.enabled || !(await isPathExists(this.cacheDir))) {
      return result
    }

    try {
      const files = await fs.promises.readdir(this.cacheDir)
      const cacheFiles = files.filter(file => file.endsWith('.json'))

      const now = Date.now()
      const ttlMs = this.options.ttlDays * 24 * 60 * 60 * 1000

      // 按修改时间排序，优先清理旧文件
      const fileStats = await Promise.all(
        cacheFiles.map(async file => {
          try {
            const filePath = path.join(this.cacheDir, file)
            const stat = await fs.promises.stat(filePath)
            return { file, filePath, mtime: stat.mtimeMs, size: stat.size }
          } catch (error) {
            result.errors.push(`Failed to stat ${file}: ${error}`)
            return null
          }
        }),
      )

      const validFiles = fileStats.filter(Boolean) as NonNullable<
        (typeof fileStats)[0]
      >[]
      validFiles.sort((a, b) => a.mtime - b.mtime)

      // 删除过期文件
      for (const { file, filePath, mtime, size } of validFiles) {
        let shouldRemove = false

        // 检查TTL
        if (now - mtime > ttlMs) {
          shouldRemove = true
        }

        // 检查数量限制
        if (
          !shouldRemove &&
          cacheFiles.length - result.removed > this.options.maxFiles
        ) {
          shouldRemove = true
        }

        // 检查缓存文件是否有效
        if (!shouldRemove) {
          try {
            const cacheData = await this._readCacheFile(filePath)
            if (!cacheData) {
              shouldRemove = true
            }
          } catch {
            shouldRemove = true
          }
        }

        if (shouldRemove) {
          try {
            await fs.promises.unlink(filePath)
            result.removed++
            result.totalSize += size

            // 同时从内存缓存中删除
            const cacheKey = path.basename(file, '.json')
            this.memoryCache.delete(cacheKey)
          } catch (error) {
            result.errors.push(`Failed to remove ${file}: ${error}`)
          }
        }
      }

      this._updateStats()
    } catch (error) {
      result.errors.push(`Cleanup failed: ${error}`)
    }

    return result
  }

  /**
   * 获取缓存统计信息
   * @returns 包括命中率和磁盘使用量的缓存统计信息
   */
  public async getStats(): Promise<CacheStats> {
    await this._ensureInitialized()

    if (!this.options.enabled) {
      return {
        hits: 0,
        misses: 0,
        files: 0,
        hitRate: 0,
        diskUsage: 0,
      }
    }

    // 计算磁盘使用量
    let diskUsage = 0

    try {
      if (await isPathExists(this.cacheDir)) {
        const files = await fs.promises.readdir(this.cacheDir)
        for (const file of files) {
          try {
            const stat = await fs.promises.stat(path.join(this.cacheDir, file))
            diskUsage += stat.size
          } catch {
            // 忽略错误
          }
        }
      }
    } catch {
      // 忽略错误
    }

    return {
      ...this.stats,
      files: this.memoryCache.size,
      diskUsage,
    }
  }

  /**
   * 清空所有缓存数据
   */
  public async clear(): Promise<void> {
    this.memoryCache.clear()

    if (!this.options.enabled || !isPathExistsSync(this.cacheDir)) {
      return
    }

    try {
      const files = await fs.promises.readdir(this.cacheDir)
      await Promise.all(
        files.map(file =>
          fs.promises.unlink(path.join(this.cacheDir, file)).catch(() => {}),
        ),
      )
    } catch {
      // 忽略错误
    }

    this._updateStats()
  }

  /**
   * 默认序列化器实现
   */
  private _defaultSerializer: CacheSerializer<T> = {
    serialize: (data: T) => data,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deserialize: (data: any) => data as T,
  }

  /**
   * 获取默认缓存目录
   */
  private _getDefaultCacheDir(): string {
    return path.join(process.env.CACHE_DIR || os.tmpdir(), '.eljs-cache')
  }

  /**
   * 默认键生成器实现
   * @param data 要生成键的数据
   * @returns 生成的缓存键
   */
  private _defaultKeyGenerator(data: T): string {
    const dataStr =
      typeof data === 'object' ? JSON.stringify(data) : String(data)
    return crypto.createHash('md5').update(dataStr).digest('hex')
  }

  /**
   * 异步初始化缓存系统
   */
  private async _initializeAsync(): Promise<void> {
    if (this._initialized) {
      return
    }

    try {
      // 确保缓存目录存在
      if (!(await isPathExists(this.cacheDir))) {
        await mkdir(this.cacheDir)
      }

      // 自动清理过期文件
      if (this.options.autoCleanup) {
        setImmediate(() => this.cleanup())
      }

      // 预加载有效缓存
      await this._preloadValidCache()

      this._initialized = true
    } catch (error) {
      console.warn('Cache initialization failed:', error)
      // 初始化失败时禁用缓存
      this.options.enabled = false
    } finally {
      // 初始化完成（无论成功或失败），清空Promise引用
      this._initializationPromise = null
    }
  }

  /**
   * 为文件路径生成缓存键
   * @param filePath 文件路径
   * @returns 缓存键
   */
  private _getCacheKey(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex')
  }

  /**
   * 计算用于内容验证的文件哈希值
   * @param filePath 文件路径
   * @returns 文件内容哈希值
   */
  private async _getFileHash(filePath: string): Promise<string> {
    try {
      const content = await readFile(filePath)
      return crypto.createHash('md5').update(content).digest('hex')
    } catch {
      return ''
    }
  }

  /**
   * 根据当前文件状态验证缓存条目
   * @param cacheEntry 要验证的缓存条目
   * @param fileStats 当前文件统计信息
   * @param filePath 文件路径
   * @returns 如果缓存有效返回 true
   */
  private async _isCacheValid(
    cacheEntry: CacheEntry<T>,
    fileStats: fs.Stats,
    filePath: string,
  ): Promise<boolean> {
    // 基本时间验证
    if (!this._isTimeValid(cacheEntry)) {
      return false
    }

    // 检查文件修改时间
    if (Math.abs(cacheEntry.mtime - fileStats.mtimeMs) > 1000) {
      // 允许1秒容差
      return false
    }

    // 检查文件大小
    if (cacheEntry.size !== fileStats.size) {
      return false
    }

    // 对于小文件，检查内容哈希值
    if (fileStats.size < 50 * 1024) {
      // 50KB以下的文件
      const currentHash = await this._getFileHash(filePath)
      if (cacheEntry.hash !== currentHash) {
        return false
      }
    }

    // 如果提供了自定义验证器，运行验证
    if (this._validator) {
      return await this._validator(cacheEntry, filePath)
    }

    return true
  }

  /**
   * 仅基于时间验证缓存条目
   * @param cacheEntry 要验证的缓存条目
   * @returns 如果未过期返回 true
   */
  private _isTimeValid(cacheEntry: CacheEntry<T>): boolean {
    const now = Date.now()
    const ttlMs = this.options.ttlDays * 24 * 60 * 60 * 1000
    return now - cacheEntry.timestamp <= ttlMs
  }

  /**
   * 从磁盘预加载有效的缓存条目到内存
   */
  private async _preloadValidCache(): Promise<void> {
    if (!(await isPathExists(this.cacheDir))) {
      return
    }

    try {
      const files = await fs.promises.readdir(this.cacheDir)
      const cacheFiles = files
        .filter(file => file.endsWith('.json'))
        .slice(0, 50)

      await Promise.all(
        cacheFiles.map(async file => {
          try {
            const cacheKey = path.basename(file, '.json')
            const cacheEntry = await this._loadFromDisk(cacheKey)

            if (cacheEntry && this._isTimeValid(cacheEntry)) {
              this.memoryCache.set(cacheKey, cacheEntry)
            } else if (cacheEntry) {
              // 过期的缓存，删除磁盘文件
              await this._removeFromDisk(cacheKey)
            }
          } catch {
            // 忽略单个文件加载错误
          }
        }),
      )
    } catch {
      // 忽略预加载错误
    }
  }

  /**
   * 从磁盘读取缓存文件
   * @param filePath 缓存文件路径
   * @returns 缓存文件数据或 null
   */
  private async _readCacheFile(filePath: string): Promise<CacheFile<T> | null> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8')
      const data = JSON.parse(content) as CacheFile<T>

      // 验证缓存文件格式
      if (!data.version || !data.data || !data.metadata) {
        return null
      }

      return data
    } catch {
      return null
    }
  }

  /**
   * 从磁盘加载缓存条目
   * @param cacheKey 缓存键
   * @returns 缓存条目或 null
   */
  private async _loadFromDisk(cacheKey: string): Promise<CacheEntry<T> | null> {
    const filePath = path.join(this.cacheDir, `${cacheKey}.json`)
    const cacheData = await this._readCacheFile(filePath)

    if (!cacheData) {
      return null
    }

    try {
      // 反序列化数据
      const data = this._serializer.deserialize(cacheData.data)

      return {
        data,
        timestamp: cacheData.metadata.timestamp,
        mtime: cacheData.metadata.mtime,
        size: cacheData.metadata.size,
        hash: cacheData.metadata.hash,
        key: cacheData.metadata.key,
      }
    } catch {
      // 反序列化失败，清理缓存文件
      await this._removeFromDisk(cacheKey)
      return null
    }
  }

  /**
   * 将缓存条目保存到磁盘
   * @param cacheKey 缓存键
   * @param cacheEntry 要保存的缓存条目
   */
  private async _saveToDisk(
    cacheKey: string,
    cacheEntry: CacheEntry<T>,
  ): Promise<void> {
    const filePath = path.join(this.cacheDir, `${cacheKey}.json`)

    const cacheFile: CacheFile<T> = {
      version: '2.0',
      data: this._serializer.serialize(cacheEntry.data),
      metadata: {
        timestamp: cacheEntry.timestamp,
        mtime: cacheEntry.mtime,
        size: cacheEntry.size,
        hash: cacheEntry.hash,
        ttl: this.options.ttlDays * 24 * 60 * 60 * 1000,
        key: cacheEntry.key,
      },
    }

    try {
      await writeJson(filePath, cacheFile)
    } catch (error) {
      console.warn(`Failed to save cache file ${filePath}:`, error)
    }
  }

  /**
   * 从磁盘删除缓存文件
   * @param cacheKey 缓存键
   */
  private async _removeFromDisk(cacheKey: string): Promise<void> {
    const filePath = path.join(this.cacheDir, `${cacheKey}.json`)

    try {
      if (await isPathExists(filePath)) {
        await remove(filePath)
      }
    } catch {
      // 忽略删除错误
    }
  }

  /**
   * 确保缓存已初始化
   */
  private async _ensureInitialized(): Promise<void> {
    if (!this._initialized && this.options.enabled) {
      // 如果已有初始化Promise，等待它完成；否则创建新的
      if (this._initializationPromise) {
        await this._initializationPromise
      } else {
        this._initializationPromise = this._initializeAsync()
        await this._initializationPromise
      }
    }
  }

  /**
   * 记录缓存命中
   */
  private _recordHit(): void {
    this.stats.hits++
    this._updateHitRate()
  }

  /**
   * 记录缓存未命中
   */
  private _recordMiss(): void {
    this.stats.misses++
    this._updateHitRate()
  }

  /**
   * 更新缓存统计信息
   */
  private _updateStats(): void {
    this.stats.files = this.memoryCache.size
    this._updateHitRate()
  }

  /**
   * 更新命中率计算
   */
  private _updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0
  }
}
