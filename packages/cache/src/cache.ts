import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  CACHE_FILE_VERSION,
  isCacheTemporaryFile,
  readCacheFile,
  STALE_CACHE_TEMP_FILE_AGE_MS,
  writeCacheFileAtomic,
} from './internal/cache-file'
import { createDefaultCacheKey } from './internal/cache-key'
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

const SMALL_FILE_HASH_LIMIT = 50 * 1024
const FILE_OPERATION_CONCURRENCY = 32
const FILE_LIMIT_ENFORCEMENT_ATTEMPTS = 3
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * 清理扫描中已完成文件系统检查的候选文件
 *
 * @remarks
 * `countsTowardFileLimit` 区分正式缓存与崩溃遗留临时文件，避免临时文件删除数量污染磁盘缓存统计
 */
interface CleanupCandidate {
  cacheData: CacheFile<unknown> | null
  cacheKey: string | undefined
  countsTowardFileLimit: boolean
  file: string
  filePath: string
  size: number
  timestamp: number
  ttl: number
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++
        const item = items[index]

        if (item !== undefined) {
          results[index] = await mapper(item, index)
        }
      }
    },
  )

  await Promise.all(workers)
  return results
}

/**
 * 提供内存 LRU 与原子磁盘持久化的双层缓存
 *
 * @remarks
 * 实例支持文件关联缓存和逻辑键缓存，同一实例内的同键读写按调用顺序执行
 * 磁盘异常按 best-effort 语义降级，不会阻断调用方继续计算源数据
 * 同一缓存目录应只服务于一套数据类型、序列化协议和缓存用途
 *
 * @typeParam T - 缓存中的业务数据类型
 */
export class Cache<T = unknown> {
  /**
   * 构造函数选项
   */
  public readonly constructorOptions: Readonly<CacheOptions<T>>
  /**
   * 缓存配置选项（已解析包含默认值）
   */
  public readonly options: Readonly<
    Required<Omit<CacheOptions<T>, 'keyGenerator' | 'serializer' | 'validator'>>
  >
  /**
   * 缓存目录路径
   */
  public readonly cacheDir: string
  private readonly _memoryCache: Map<string, CacheEntry<T>> = new Map()
  private readonly _stats: CacheStats = {
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
   * 当前实例是否仍可用，初始化失败后变为 `false`
   */
  private _enabled: boolean
  /**
   * 初始化Promise，用于防止重复初始化
   */
  private _initializationPromise: Promise<void> | null = null
  /**
   * 数据序列化器
   */
  private readonly _serializer: CacheSerializer<T>
  /**
   * 键生成器函数
   */
  private readonly _keyGenerator: CacheKeyGenerator<T>
  /**
   * 缓存验证器
   */
  private readonly _validator?: CacheValidator<T>
  /**
   * 已完成边界校验并按毫秒取整的条目存活时间
   */
  private readonly _ttlMilliseconds: number
  /**
   * 当前磁盘文件计数是否来自一次成功的目录扫描
   *
   * @remarks
   * 扫描失败时计数只能用于观测，后续成功写入必须触发清理重扫，不能把未知状态当成空目录
   */
  private _diskFileCountKnown = false
  /**
   * 当前清理任务，同一实例同时只扫描一次缓存目录
   */
  private _cleanupPromise: Promise<CleanupResult> | null = null
  /**
   * 当前清空任务，后续写入必须等待清空完成后再进入新生命周期
   */
  private _clearPromise: Promise<void> | null = null
  /**
   * 按缓存键串行的读写任务，保证同一键的校验、删除与磁盘发布互不覆盖
   */
  private readonly _keyOperations: Map<string, Promise<void>> = new Map()
  /**
   * 清空操作递增的生命周期代次，旧代次中尚未落盘的写入必须放弃发布
   */
  private _generation = 0

  /**
   * 缓存是否已初始化
   */
  public get initialized(): boolean {
    return this._initialized
  }

  /**
   * 当前实例是否可执行缓存读写
   *
   * @remarks
   * 该值同时受构造配置和初始化结果影响，初始化失败时会自动变为 `false`
   */
  public get enabled(): boolean {
    return this._enabled
  }

  /**
   * 当前只读的内存缓存快照
   *
   * @remarks
   * 该视图用于诊断和观测，条目数量受 `maxFiles` 的 LRU 约束
   */
  public get memoryCache(): ReadonlyMap<string, Readonly<CacheEntry<T>>> {
    return new Map(
      [...this._memoryCache].map(([cacheKey, cacheEntry]) => [
        cacheKey,
        Object.freeze({ ...cacheEntry }),
      ]),
    )
  }

  /**
   * 当前缓存统计快照
   *
   * @remarks
   * 命中统计会实时更新，磁盘文件数和空间使用量由 `getStats` 刷新为权威值
   */
  public get stats(): Readonly<CacheStats> {
    return { ...this._stats }
  }

  /**
   * 创建新的缓存实例
   *
   * @remarks
   * 启用缓存时会立即启动异步初始化，首次调用异步方法会等待初始化完成
   * 初始化失败后实例会自动降级为禁用状态，读取返回未命中且写入不生效
   *
   * @param options - 缓存配置选项，包括自定义函数
   * @throws `cacheDir` 为空、TTL 无法安全转换为正毫秒数或最大文件数不是正安全整数时抛出
   */
  public constructor(options: CacheOptions<T> = {}) {
    this.constructorOptions = Object.freeze({ ...options })

    const cacheDir = options.cacheDir ?? this._getDefaultCacheDir()
    const ttlDays = options.ttlDays ?? 7
    const maxFiles = options.maxFiles ?? 1000
    const ttlMilliseconds = ttlDays * MILLISECONDS_PER_DAY

    if (typeof cacheDir !== 'string' || cacheDir.trim().length === 0) {
      throw new TypeError('cacheDir must be a non-empty string')
    }

    if (options.enabled !== undefined && typeof options.enabled !== 'boolean') {
      throw new TypeError('enabled must be a boolean')
    }

    if (
      options.autoCleanup !== undefined &&
      typeof options.autoCleanup !== 'boolean'
    ) {
      throw new TypeError('autoCleanup must be a boolean')
    }

    if (
      !Number.isFinite(ttlDays) ||
      ttlDays <= 0 ||
      !Number.isFinite(ttlMilliseconds) ||
      ttlMilliseconds <= 0 ||
      ttlMilliseconds > Number.MAX_SAFE_INTEGER
    ) {
      throw new RangeError(
        'ttlDays must produce a finite positive TTL no greater than Number.MAX_SAFE_INTEGER milliseconds',
      )
    }

    if (!Number.isSafeInteger(maxFiles) || maxFiles <= 0) {
      throw new RangeError('maxFiles must be a positive safe integer')
    }

    if (
      options.keyGenerator !== undefined &&
      typeof options.keyGenerator !== 'function'
    ) {
      throw new TypeError('keyGenerator must be a function')
    }

    if (
      options.validator !== undefined &&
      typeof options.validator !== 'function'
    ) {
      throw new TypeError('validator must be a function')
    }

    if (
      options.serializer !== undefined &&
      (typeof options.serializer !== 'object' ||
        options.serializer === null ||
        typeof options.serializer.serialize !== 'function' ||
        typeof options.serializer.deserialize !== 'function')
    ) {
      throw new TypeError(
        'serializer must define serialize and deserialize functions',
      )
    }

    // 使用默认值设置选项（扁平化选项结构）
    this.options = Object.freeze({
      enabled: options.enabled ?? true,
      cacheDir,
      ttlDays,
      autoCleanup: options.autoCleanup ?? true,
      maxFiles,
    })
    this._enabled = this.options.enabled
    this._ttlMilliseconds = Math.max(1, Math.round(ttlMilliseconds))

    this.cacheDir = path.resolve(this.options.cacheDir)

    // 设置自定义函数或使用默认值
    this._serializer = options.serializer ?? this._defaultSerializer
    this._keyGenerator = options.keyGenerator ?? createDefaultCacheKey
    this._validator = options.validator

    if (this.enabled) {
      // 延迟初始化以避免阻塞启动，但缓存Promise以防止重复执行
      this._initializationPromise = this._initializeAsync()
    }
  }

  /**
   * 通过文件路径获取缓存数据
   *
   * @remarks
   * 文件身份按绝对路径归一化；源文件不存在、条目过期、校验失败或发生 I/O 错误时均返回 `null`
   * 命中对象数据时返回内存中的同一引用，调用方不应直接修改该对象
   *
   * @param filePath - 要获取缓存的文件路径
   * @returns 缓存的数据，如果未找到或无效则返回 null
   */
  public async get(filePath: string): Promise<T | null> {
    if (!this.enabled) {
      return null
    }

    await this._ensureInitialized()

    if (!this.enabled) {
      return null
    }

    await this._waitForClear()

    const normalizedPath = path.resolve(filePath)
    const cacheKey = this._getCacheKey(normalizedPath)
    const generation = this._generation

    try {
      return await this._runKeyOperation(cacheKey, async () => {
        if (generation !== this._generation) {
          this._recordMiss()
          return null
        }

        let fileStats: fs.Stats

        try {
          fileStats = await fs.promises.stat(normalizedPath)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error
          }

          if (generation === this._generation) {
            this._memoryCache.delete(cacheKey)
            await this._removeFromDisk(cacheKey)
          }

          this._recordMiss()
          return null
        }

        // 首先检查内存缓存
        let cacheEntry = this._memoryCache.get(cacheKey)

        // 如果不在内存中，尝试从磁盘加载
        if (!cacheEntry) {
          const diskEntry = await this._loadFromDisk(cacheKey)
          if (diskEntry && generation === this._generation) {
            cacheEntry = diskEntry
            this._setMemoryEntry(cacheKey, cacheEntry)
          }
        }

        // 验证缓存
        if (
          cacheEntry &&
          generation === this._generation &&
          (await this._isCacheValid(cacheEntry, fileStats, normalizedPath))
        ) {
          if (generation !== this._generation) {
            this._recordMiss()
            return null
          }

          this._setMemoryEntry(cacheKey, cacheEntry)
          this._recordHit()
          return cacheEntry.data
        }

        if (generation !== this._generation) {
          this._recordMiss()
          return null
        }

        // 缓存无效，清理
        if (cacheEntry) {
          this._memoryCache.delete(cacheKey)
          await this._removeFromDisk(cacheKey)
        }

        this._recordMiss()
        return null
      })
    } catch (error) {
      console.warn(`Failed to get cache for ${normalizedPath}:`, error)
      this._recordMiss()
      return null
    }
  }

  /**
   * 为文件路径设置缓存数据
   *
   * @remarks
   * 同一缓存键的写入按调用顺序串行，内存写入成功但磁盘持久化失败时方法仍会正常结束并输出警告
   * 若执行期间发生 `clear`，该次旧生命周期写入会被放弃
   *
   * @param filePath - 要缓存数据的文件路径
   * @param data - 要缓存的数据
   */
  public async set(filePath: string, data: T): Promise<void> {
    if (!this.enabled) {
      return
    }

    const generation = this._generation
    await this._ensureInitialized()

    if (!this.enabled) {
      return
    }

    await this._waitForClear()

    if (generation !== this._generation) {
      return
    }

    const normalizedPath = path.resolve(filePath)
    const cacheKey = this._getCacheKey(normalizedPath)
    let shouldCleanup = false

    try {
      await this._runKeyOperation(cacheKey, async () => {
        const fileStats = await fs.promises.stat(normalizedPath)
        const fileHash =
          fileStats.size < SMALL_FILE_HASH_LIMIT
            ? await this._getFileHash(normalizedPath)
            : ''

        if (generation !== this._generation) {
          return
        }

        const cacheEntry: CacheEntry<T> = {
          data,
          timestamp: Date.now(),
          ttl: this._ttlMilliseconds,
          mtime: fileStats.mtimeMs,
          size: fileStats.size,
          hash: fileHash,
          key: cacheKey,
        }

        this._setMemoryEntry(cacheKey, cacheEntry)
        const saved = await this._saveToDisk(cacheKey, cacheEntry)

        shouldCleanup =
          saved &&
          (!this._diskFileCountKnown ||
            this._stats.files > this.options.maxFiles) &&
          generation === this._generation
      })
    } catch (error) {
      console.warn(`Failed to cache data for ${normalizedPath}:`, error)
    }

    if (shouldCleanup) {
      await this._enforceFileLimit()
    }
  }

  /**
   * 通过数据设置缓存（非基于文件）
   *
   * @remarks
   * 返回的键可直接传给 `getByKey`，同一生成键的后续写入会覆盖先前数据
   * 若缓存已禁用或写入被并发的 `clear` 取消，则返回 `null`
   *
   * @param data - 要缓存的数据
   * @param metadata - 可选的元数据
   * @returns 实际使用的缓存键，未写入时返回 `null`
   * @throws 键生成器抛错、返回空键或时间戳不是非负安全整数时抛出
   */
  public async setByData(
    data: T,
    metadata?: { timestamp?: number },
  ): Promise<string | null> {
    if (!this.enabled) {
      return null
    }

    const generation = this._generation
    await this._ensureInitialized()

    if (!this.enabled) {
      return null
    }

    await this._waitForClear()

    if (generation !== this._generation) {
      return null
    }

    const timestamp = metadata?.timestamp ?? Date.now()

    if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
      throw new RangeError(
        'metadata.timestamp must be a non-negative safe integer',
      )
    }

    const cacheKey = this._keyGenerator(data)
    this._validateCacheKey(cacheKey)
    let stored = false
    let shouldCleanup = false

    try {
      await this._runKeyOperation(cacheKey, async () => {
        if (generation !== this._generation) {
          return
        }

        const cacheEntry: CacheEntry<T> = {
          data,
          timestamp,
          ttl: this._ttlMilliseconds,
          mtime: Date.now(),
          size: 0,
          hash: '',
          key: cacheKey,
        }

        this._setMemoryEntry(cacheKey, cacheEntry)
        const saved = await this._saveToDisk(cacheKey, cacheEntry)
        stored = true

        shouldCleanup =
          saved &&
          (!this._diskFileCountKnown ||
            this._stats.files > this.options.maxFiles) &&
          generation === this._generation
      })
    } catch (error) {
      console.warn(`Failed to cache data:`, error)
    }

    if (shouldCleanup) {
      await this._enforceFileLimit()
    }

    return stored ? cacheKey : null
  }

  /**
   * 通过键获取缓存数据
   *
   * @remarks
   * 同一键存在进行中的写入时会等待写入结束，过期条目会同时从内存和磁盘删除
   *
   * @param key - 缓存键
   * @returns 缓存的数据，如果未找到或无效则返回 null
   * @throws 键为空或不是字符串时抛出
   */
  public async getByKey(key: string): Promise<T | null> {
    if (!this.enabled) {
      return null
    }

    await this._ensureInitialized()

    if (!this.enabled) {
      return null
    }

    this._validateCacheKey(key)
    await this._waitForClear()
    const generation = this._generation

    try {
      return await this._runKeyOperation(key, async () => {
        if (generation !== this._generation) {
          this._recordMiss()
          return null
        }

        // 首先检查内存缓存
        let cacheEntry = this._memoryCache.get(key)

        // 如果不在内存中，尝试从磁盘加载
        if (!cacheEntry) {
          const diskEntry = await this._loadFromDisk(key)
          if (diskEntry && generation === this._generation) {
            cacheEntry = diskEntry
            this._setMemoryEntry(key, cacheEntry)
          }
        }

        // 验证缓存（基于键的缓存使用时间验证）
        if (
          cacheEntry &&
          generation === this._generation &&
          this._isTimeValid(cacheEntry)
        ) {
          this._setMemoryEntry(key, cacheEntry)
          this._recordHit()
          return cacheEntry.data
        }

        if (generation !== this._generation) {
          this._recordMiss()
          return null
        }

        // 缓存无效，清理
        if (cacheEntry) {
          this._memoryCache.delete(key)
          await this._removeFromDisk(key)
        }

        this._recordMiss()
        return null
      })
    } catch (error) {
      console.warn('Failed to get cache by key:', error)
      this._recordMiss()
      return null
    }
  }

  /**
   * 清理过期和无效的缓存文件
   *
   * @remarks
   * TTL 以缓存条目的创建时间为准，超过数量上限时按最旧条目优先淘汰
   * 超过 24 小时的原子写临时文件会一并回收，新近临时文件保留给可能仍在执行的写入
   * 同一实例的并发调用共享一次目录扫描，扫描开始后的按键读写会等待清理完成，单文件操作使用有限并发
   *
   * @returns 包含统计信息的清理结果
   */
  public cleanup(): Promise<CleanupResult> {
    if (this._cleanupPromise) {
      return this._cleanupPromise
    }

    const activeClear = this._clearPromise
    const activeOperations = [...this._keyOperations.values()]
    this._cleanupPromise = this._cleanupInternal(
      activeClear,
      activeOperations,
    ).finally(() => {
      this._cleanupPromise = null
    })

    return this._cleanupPromise
  }

  /**
   * 等待初始化和已开始的按键读写结束后执行一次清理扫描
   *
   * @remarks
   * 初始化目录扫描与清理不能并发读取同一目录，否则删除计数和磁盘统计会因竞争失真
   * 只等待调用开始前已经存在的清空任务；后启动的 `clear` 会反向等待本次清理，避免循环等待
   *
   * @param activeClear - 调用 `cleanup` 时已经存在的清空任务
   * @param activeOperations - 调用 `cleanup` 时已经存在的按键读写任务
   * @returns 本次扫描实际删除的文件和错误信息
   */
  private async _cleanupInternal(
    activeClear: Promise<void> | null,
    activeOperations: readonly Promise<void>[],
  ): Promise<CleanupResult> {
    const result: CleanupResult = {
      removed: 0,
      totalSize: 0,
      errors: [],
    }

    await this._ensureInitialized()

    if (!this.enabled) {
      return result
    }

    await activeClear
    await Promise.allSettled(activeOperations)

    try {
      let files: string[]

      try {
        files = await fs.promises.readdir(this.cacheDir)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          this._stats.files = 0
          this._diskFileCountKnown = true
          return result
        }

        throw error
      }

      const cacheFiles = files.filter(file => this._isManagedCacheFile(file))
      const temporaryFiles = files.filter(isCacheTemporaryFile)
      const now = Date.now()
      const candidates = await mapWithConcurrency<
        string,
        CleanupCandidate | null
      >(cacheFiles, FILE_OPERATION_CONCURRENCY, async file => {
        try {
          const filePath = path.join(this.cacheDir, file)
          const [stat, cacheData] = await Promise.all([
            fs.promises.stat(filePath),
            readCacheFile(filePath),
          ])

          return {
            cacheData,
            cacheKey: cacheData?.metadata.key,
            file,
            filePath,
            size: stat.size,
            timestamp: cacheData?.metadata.timestamp ?? stat.mtimeMs,
            ttl: cacheData?.metadata.ttl ?? this._ttlMilliseconds,
            countsTowardFileLimit: true,
          }
        } catch (error) {
          result.errors.push(`Failed to inspect ${file}: ${error}`)
          return null
        }
      })
      const staleTemporaryFiles = (
        await mapWithConcurrency<string, CleanupCandidate | null>(
          temporaryFiles,
          FILE_OPERATION_CONCURRENCY,
          async file => {
            try {
              const filePath = path.join(this.cacheDir, file)
              const stat = await fs.promises.stat(filePath)

              if (now - stat.mtimeMs <= STALE_CACHE_TEMP_FILE_AGE_MS) {
                return null
              }

              return {
                cacheData: null,
                cacheKey: undefined,
                file,
                filePath,
                size: stat.size,
                timestamp: stat.mtimeMs,
                ttl: STALE_CACHE_TEMP_FILE_AGE_MS,
                countsTowardFileLimit: false,
              }
            } catch (error) {
              result.errors.push(`Failed to inspect ${file}: ${error}`)
              return null
            }
          },
        )
      ).filter((candidate): candidate is CleanupCandidate => candidate !== null)
      const inspectedFiles = candidates.filter(
        (candidate): candidate is CleanupCandidate => candidate !== null,
      )
      const removalCandidates = new Set(
        inspectedFiles.filter(
          candidate =>
            !candidate.cacheData || now - candidate.timestamp > candidate.ttl,
        ),
      )
      const retainedCandidates = inspectedFiles
        .filter(candidate => !removalCandidates.has(candidate))
        .sort((a, b) => a.timestamp - b.timestamp)
      const overflow = Math.max(
        0,
        retainedCandidates.length - this.options.maxFiles,
      )

      for (const candidate of retainedCandidates.slice(0, overflow)) {
        removalCandidates.add(candidate)
      }

      let removedCacheFiles = 0
      await mapWithConcurrency(
        [...removalCandidates, ...staleTemporaryFiles],
        FILE_OPERATION_CONCURRENCY,
        async ({ cacheKey, countsTowardFileLimit, file, filePath, size }) => {
          try {
            await fs.promises.unlink(filePath)
            result.removed++
            result.totalSize += size

            if (countsTowardFileLimit) {
              removedCacheFiles++
            }

            if (cacheKey !== undefined) {
              this._memoryCache.delete(cacheKey)
            } else if (countsTowardFileLimit) {
              this._removeMemoryEntryForFile(file)
            }
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
              result.errors.push(`Failed to remove ${file}: ${error}`)
            }
          }
        },
      )

      this._stats.files = cacheFiles.length - removedCacheFiles
      this._diskFileCountKnown = true
    } catch (error) {
      this._diskFileCountKnown = false
      result.errors.push(`Cleanup failed: ${error}`)
    }

    return result
  }

  /**
   * 获取缓存统计信息
   *
   * @remarks
   * `files` 和 `diskUsage` 只统计当前库管理的缓存文件，不包含同目录下的其他文件
   *
   * @returns 包括命中率和磁盘使用量的缓存统计信息
   */
  public async getStats(): Promise<CacheStats> {
    await this._ensureInitialized()

    if (!this.enabled) {
      return {
        hits: 0,
        misses: 0,
        files: 0,
        hitRate: 0,
        diskUsage: 0,
      }
    }

    await this._waitForClear()

    let diskUsage = 0
    try {
      const files = (await fs.promises.readdir(this.cacheDir)).filter(file =>
        this._isManagedCacheFile(file),
      )
      const fileSizes = await mapWithConcurrency(
        files,
        FILE_OPERATION_CONCURRENCY,
        async file => {
          try {
            const stat = await fs.promises.stat(path.join(this.cacheDir, file))
            return stat.size
          } catch {
            return null
          }
        },
      )

      for (const size of fileSizes) {
        if (size !== null) {
          diskUsage += size
        }
      }

      // 单文件 stat 失败不能让文件上限低估，目录快照仍是数量的权威来源
      this._stats.files = files.length
      this._stats.diskUsage = diskUsage
      this._diskFileCountKnown = true
    } catch {
      // 扫描失败时保留上一次观测值，并让后续成功写入重新触发权威扫描
      this._diskFileCountKnown = false
    }

    return { ...this._stats }
  }

  /**
   * 清空所有缓存数据
   *
   * @remarks
   * 清空操作会取消尚未发布的旧生命周期写入，并等待已经开始的按键读写结束后删除受管理文件
   * 同一实例的并发调用共享同一个清空任务
   */
  public clear(): Promise<void> {
    if (this._clearPromise) {
      return this._clearPromise
    }

    const activeCleanup = this._cleanupPromise
    const activeOperations = [...this._keyOperations.values()]
    this._generation++
    this._clearPromise = this._clearInternal(
      activeCleanup,
      activeOperations,
    ).finally(() => {
      this._clearPromise = null
    })

    return this._clearPromise
  }

  /**
   * 执行一次生命周期隔离的清空操作
   *
   * @remarks
   * 先等待调用开始前已经存在的清理和按键读写，再删除受管理文件
   * `clear` 已提前递增代次，因此旧代次中尚未进入发布阶段的写入会主动放弃
   *
   * @param activeCleanup - 调用 `clear` 时已经存在的清理任务
   * @param activeOperations - 调用 `clear` 时已经存在的按键读写任务
   * @returns 内存和磁盘中的受管理缓存均完成清空后结束
   */
  private async _clearInternal(
    activeCleanup: Promise<CleanupResult> | null,
    activeOperations: readonly Promise<void>[],
  ): Promise<void> {
    if (this._initializationPromise) {
      await this._initializationPromise
    }

    await activeCleanup
    await Promise.allSettled(activeOperations)
    this._memoryCache.clear()

    try {
      const files = await fs.promises.readdir(this.cacheDir)
      const cacheFiles = files.filter(
        file => this._isManagedCacheFile(file) || isCacheTemporaryFile(file),
      )

      await mapWithConcurrency(
        cacheFiles,
        FILE_OPERATION_CONCURRENCY,
        async file => {
          await fs.promises
            .unlink(path.join(this.cacheDir, file))
            .catch(() => {})
        },
      )
    } catch {
      // 忽略错误
    }

    this._memoryCache.clear()
    this._stats.files = 0
    this._stats.diskUsage = 0
    // 单文件删除采用 best-effort 语义，下一次写入重扫才能确认磁盘确实为空
    this._diskFileCountKnown = false
  }

  /**
   * 默认序列化器实现
   */
  private readonly _defaultSerializer: CacheSerializer<T> = {
    serialize: (data: T) => data,
    deserialize: (data: unknown) => data as T,
  }

  /**
   * 获取默认缓存目录
   */
  private _getDefaultCacheDir(): string {
    return path.join(process.env.CACHE_DIR || os.tmpdir(), '.eljs-cache')
  }

  /**
   * 异步初始化缓存系统
   */
  private async _initializeAsync(): Promise<void> {
    if (this._initialized) {
      return
    }

    try {
      await fs.promises.mkdir(this.cacheDir, { recursive: true, mode: 0o700 })

      try {
        const files = await fs.promises.readdir(this.cacheDir)
        this._stats.files = files.filter(file =>
          this._isManagedCacheFile(file),
        ).length
        this._diskFileCountKnown = true
      } catch {
        // 内存层仍可使用，但下一次成功落盘必须通过清理重建权威计数
        this._stats.files = 0
        this._diskFileCountKnown = false
      }

      this._initialized = true

      if (this.options.autoCleanup) {
        setImmediate(() => {
          void this.cleanup()
        })
      }
    } catch (error) {
      console.warn('Cache initialization failed:', error)
      // 初始化失败时禁用缓存
      this._enabled = false
    } finally {
      // 初始化完成（无论成功或失败），清空Promise引用
      this._initializationPromise = null
    }
  }

  /**
   * 为文件路径生成缓存键
   * @param filePath - 文件路径
   * @returns 缓存键
   */
  private _getCacheKey(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex')
  }

  /**
   * 将任意逻辑键转换为固定长度且路径安全的文件名
   */
  private _getCacheFilePath(cacheKey: string): string {
    const fileName = crypto.createHash('sha256').update(cacheKey).digest('hex')

    return path.join(this.cacheDir, `${fileName}.json`)
  }

  /**
   * 判断文件是否属于当前哈希格式或历史 MD5 文件键格式
   */
  private _isManagedCacheFile(fileName: string): boolean {
    return /^(?:[a-f0-9]{32}|[a-f0-9]{64})\.json$/u.test(fileName)
  }

  /**
   * 计算用于内容验证的文件哈希值
   * @param filePath - 文件路径
   * @returns 文件内容哈希值
   */
  private async _getFileHash(filePath: string): Promise<string> {
    const content = await fs.promises.readFile(filePath)
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  /**
   * 根据当前文件状态验证缓存条目
   * @param cacheEntry - 要验证的缓存条目
   * @param fileStats - 当前文件统计信息
   * @param filePath - 文件路径
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

    // 检查文件大小
    if (cacheEntry.size !== fileStats.size) {
      return false
    }

    if (fileStats.size < SMALL_FILE_HASH_LIMIT) {
      // 小文件以内容哈希为准，避免低精度文件系统时间戳造成误判
      const currentHash = await this._getFileHash(filePath)
      if (cacheEntry.hash !== currentHash) {
        return false
      }
    } else if (cacheEntry.mtime !== fileStats.mtimeMs) {
      // 大文件不重复读取全文，任何修改时间变化都必须使缓存失效
      return false
    }

    // 如果提供了自定义验证器，运行验证
    if (this._validator) {
      try {
        return await this._validator(Object.freeze({ ...cacheEntry }), filePath)
      } catch (error) {
        console.warn(`Cache validator failed for ${filePath}:`, error)
        return false
      }
    }

    return true
  }

  /**
   * 仅基于时间验证缓存条目
   * @param cacheEntry - 要验证的缓存条目
   * @returns 如果未过期返回 true
   */
  private _isTimeValid(cacheEntry: CacheEntry<T>): boolean {
    const now = Date.now()
    return now - cacheEntry.timestamp <= cacheEntry.ttl
  }

  /**
   * 将已校验的磁盘结构反序列化为内存条目
   *
   * @param cacheData - 已通过运行时格式校验的缓存文件
   * @returns 可放入内存层的缓存条目
   */
  private _deserializeCacheFile(cacheData: CacheFile<unknown>): CacheEntry<T> {
    const serializedData = cacheData.metadata.dataUndefined
      ? undefined
      : cacheData.data

    return {
      data: this._serializer.deserialize(serializedData),
      timestamp: cacheData.metadata.timestamp,
      ttl: cacheData.metadata.ttl,
      mtime: cacheData.metadata.mtime,
      size: cacheData.metadata.size,
      hash: cacheData.metadata.hash,
      key: cacheData.metadata.key,
    }
  }

  /**
   * 从磁盘加载缓存条目
   * @param cacheKey - 缓存键
   * @returns 缓存条目或 null
   */
  private async _loadFromDisk(cacheKey: string): Promise<CacheEntry<T> | null> {
    const currentPath = this._getCacheFilePath(cacheKey)
    const candidatePaths = [currentPath]

    if (/^[a-f0-9]{32}$/u.test(cacheKey)) {
      candidatePaths.push(path.join(this.cacheDir, `${cacheKey}.json`))
    }

    for (const filePath of candidatePaths) {
      const cacheData = await readCacheFile(filePath)

      if (!cacheData) {
        await this._unlinkManagedFile(filePath)
        continue
      }

      if (cacheData.metadata.key !== cacheKey) {
        await this._unlinkManagedFile(filePath)
        continue
      }

      try {
        const cacheEntry = this._deserializeCacheFile(cacheData)

        await this._migrateCacheFile(cacheKey, cacheEntry, filePath)

        return cacheEntry
      } catch {
        await this._unlinkManagedFile(filePath)
      }
    }

    return null
  }

  /**
   * 将历史文件名迁移到当前哈希命名格式
   *
   * @remarks
   * 只有新文件原子发布成功后才删除旧文件，避免迁移失败造成有效缓存丢失
   *
   * @param cacheKey - 未哈希的逻辑缓存键
   * @param cacheEntry - 已完成格式校验和反序列化的条目
   * @param sourcePath - 当前读取到的磁盘文件绝对路径
   * @returns 无需迁移或迁移尝试结束后完成
   */
  private async _migrateCacheFile(
    cacheKey: string,
    cacheEntry: CacheEntry<T>,
    sourcePath: string,
  ): Promise<void> {
    if (sourcePath === this._getCacheFilePath(cacheKey)) {
      return
    }

    if (!(await this._saveToDisk(cacheKey, cacheEntry))) {
      return
    }

    await this._unlinkManagedFile(sourcePath)
  }

  /**
   * 将缓存条目保存到磁盘
   * @param cacheKey - 缓存键
   * @param cacheEntry - 要保存的缓存条目
   */
  private async _saveToDisk(
    cacheKey: string,
    cacheEntry: CacheEntry<T>,
  ): Promise<boolean> {
    const filePath = this._getCacheFilePath(cacheKey)

    try {
      const serializedData = this._serializer.serialize(cacheEntry.data)
      const dataUndefined = serializedData === undefined
      const cacheFile: CacheFile<unknown> = {
        version: CACHE_FILE_VERSION,
        data: dataUndefined ? null : serializedData,
        metadata: {
          timestamp: cacheEntry.timestamp,
          mtime: cacheEntry.mtime,
          size: cacheEntry.size,
          hash: cacheEntry.hash,
          ttl: cacheEntry.ttl,
          key: cacheEntry.key,
          dataUndefined: dataUndefined || undefined,
        },
      }
      const existed = await fs.promises
        .access(filePath)
        .then(() => true)
        .catch(() => false)
      await writeCacheFileAtomic(filePath, cacheFile)

      if (!existed) {
        this._stats.files++
      }

      return true
    } catch (error) {
      console.warn(`Failed to save cache file ${filePath}:`, error)
      return false
    }
  }

  /**
   * 从磁盘删除缓存文件
   * @param cacheKey - 缓存键
   */
  private async _removeFromDisk(cacheKey: string): Promise<void> {
    const filePaths = [this._getCacheFilePath(cacheKey)]

    if (/^[a-f0-9]{32}$/u.test(cacheKey)) {
      filePaths.push(path.join(this.cacheDir, `${cacheKey}.json`))
    }

    for (const filePath of filePaths) {
      await this._unlinkManagedFile(filePath)
    }
  }

  /**
   * 删除单个受管理缓存文件并同步实例文件计数
   *
   * @remarks
   * 文件已经不存在时视为成功收敛，其他删除错误只记录警告并按 best-effort 语义降级
   *
   * @param filePath - 受管理缓存文件的绝对路径
   * @returns 删除完成或按 best-effort 降级后结束
   */
  private async _unlinkManagedFile(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath)
      this._stats.files = Math.max(0, this._stats.files - 1)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`Failed to remove cache file ${filePath}:`, error)
      }
    }
  }

  /**
   * 写入内存层并按访问顺序执行 LRU 淘汰
   *
   * @param cacheKey - 逻辑缓存键
   * @param cacheEntry - 要写入的缓存条目
   */
  private _setMemoryEntry(cacheKey: string, cacheEntry: CacheEntry<T>): void {
    this._memoryCache.delete(cacheKey)
    this._memoryCache.set(cacheKey, cacheEntry)

    while (this._memoryCache.size > this.options.maxFiles) {
      const oldestKey = this._memoryCache.keys().next().value as
        string | undefined

      if (oldestKey === undefined) {
        break
      }

      this._memoryCache.delete(oldestKey)
    }
  }

  /**
   * 在有限轮次内收敛磁盘文件数量
   *
   * @remarks
   * 并发写入可能共享同一次清理扫描，因此每轮根据清理结果判断是否继续收敛
   * 最多执行三轮，避免持续外部写入或删除失败使单次缓存写入长期阻塞
   */
  private async _enforceFileLimit(): Promise<void> {
    for (
      let attempt = 0;
      attempt < FILE_LIMIT_ENFORCEMENT_ATTEMPTS;
      attempt++
    ) {
      await this.cleanup()

      if (
        this._diskFileCountKnown &&
        this._stats.files <= this.options.maxFiles
      ) {
        return
      }
    }
  }

  /**
   * 在缓存文件无法解析出逻辑键时按文件名清理对应内存条目
   *
   * @param fileName - 受管理的缓存文件名
   */
  private _removeMemoryEntryForFile(fileName: string): void {
    for (const cacheKey of this._memoryCache.keys()) {
      if (
        path.basename(this._getCacheFilePath(cacheKey)) === fileName ||
        `${cacheKey}.json` === fileName
      ) {
        this._memoryCache.delete(cacheKey)
      }
    }
  }

  /**
   * 校验来自自定义键生成器或调用方的不可信逻辑键
   *
   * @param cacheKey - 待校验的逻辑键
   * @throws 缓存键不是非空字符串时抛出
   */
  private _validateCacheKey(cacheKey: unknown): asserts cacheKey is string {
    if (typeof cacheKey !== 'string' || cacheKey.length === 0) {
      throw new TypeError('cache key must be a non-empty string')
    }
  }

  /**
   * 将同一键的读写追加到串行任务链
   *
   * @remarks
   * 调用开始时已有的目录清理会先完成，避免清理依据旧快照删除随后发布的新条目
   *
   * @typeParam R - 缓存任务的返回值类型
   * @param cacheKey - 逻辑缓存键
   * @param operation - 需要串行执行的缓存任务
   * @returns 缓存任务的返回值
   */
  private async _runKeyOperation<R>(
    cacheKey: string,
    operation: () => Promise<R>,
  ): Promise<R> {
    const previous = this._keyOperations.get(cacheKey) ?? Promise.resolve()
    const activeCleanup = this._cleanupPromise
    const current = previous
      .catch(() => {})
      .then(() => activeCleanup)
      .then(operation)
    const completion = current.then(
      () => {},
      () => {},
    )

    this._keyOperations.set(cacheKey, completion)

    try {
      return await current
    } finally {
      if (this._keyOperations.get(cacheKey) === completion) {
        this._keyOperations.delete(cacheKey)
      }
    }
  }

  /**
   * 等待当前清空生命周期完成
   */
  private async _waitForClear(): Promise<void> {
    await this._clearPromise
  }

  /**
   * 确保缓存已初始化
   */
  private async _ensureInitialized(): Promise<void> {
    if (!this._initialized && this.enabled) {
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
    this._stats.hits++
    this._updateHitRate()
  }

  /**
   * 记录缓存未命中
   */
  private _recordMiss(): void {
    this._stats.misses++
    this._updateHitRate()
  }

  /**
   * 更新命中率计算
   */
  private _updateHitRate(): void {
    const total = this._stats.hits + this._stats.misses
    this._stats.hitRate = total > 0 ? this._stats.hits / total : 0
  }
}
