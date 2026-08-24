import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { Cache, CacheValidator } from '../src'
import { isCacheFile } from '../src/internal/cache-file'
import {
  cleanupDir,
  createTempDir,
  createTempFile,
  waitForCondition,
} from './test-utils'

describe('Cache 验证和 TTL 测试', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempDir('cache-validation-test-')
  })

  afterEach(() => {
    cleanupDir(tempDir)
  })

  describe('磁盘格式校验', () => {
    it('应该拒绝超出写入约束的缓存元数据', () => {
      const metadata = {
        timestamp: Date.now(),
        mtime: Date.now(),
        size: 0,
        hash: '',
        ttl: 1000,
        key: 'validated-key',
      }
      const invalidMetadata: Array<Record<string, unknown>> = [
        { ...metadata, timestamp: 1.5 },
        { ...metadata, timestamp: Number.MAX_SAFE_INTEGER + 1 },
        { ...metadata, size: 1.5 },
        { ...metadata, size: Number.MAX_SAFE_INTEGER + 1 },
        { ...metadata, ttl: 0 },
        { ...metadata, ttl: 1.5 },
        { ...metadata, ttl: Number.MAX_SAFE_INTEGER + 1 },
        { ...metadata, hash: 'not-a-sha256-hash' },
      ]

      expect(isCacheFile({ version: '2.0', data: 'valid', metadata })).toBe(
        true,
      )

      for (const invalid of invalidMetadata) {
        expect(
          isCacheFile({ version: '2.0', data: 'invalid', metadata: invalid }),
        ).toBe(false)
      }
    })
  })

  describe('文件缓存验证', () => {
    it('应该在文件内容变化时使缓存失效（小文件）', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      const testContent = 'a'.repeat(16) // 小于50KB
      const testFile = createTempFile(tempDir, 'small.txt', testContent)

      // 设置缓存
      await cache.set(testFile, 'cached data')

      // 验证缓存有效
      let result = await cache.get(testFile)
      expect(result).toBe('cached data')
      expect(cache.stats.hits).toBe(1)

      // 修改文件内容但保持相同大小
      fs.writeFileSync(testFile, 'b'.repeat(16))

      // 缓存应该失效，因为内容哈希值改变
      result = await cache.get(testFile)
      expect(result).toBeNull()
      expect(cache.stats.misses).toBe(1)
    })

    it('应该检测大文件的变化', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      // 创建大文件（超过50KB）
      const largeContent = 'x'.repeat(60 * 1024)
      const testFile = createTempFile(tempDir, 'large.txt', largeContent)

      await cache.set(testFile, 'cached large data')

      let result = await cache.get(testFile)
      expect(result).toBe('cached large data')

      // 在短时间内写入同样大小的新内容
      fs.writeFileSync(testFile, 'y'.repeat(60 * 1024))

      result = await cache.get(testFile)
      expect(result).toBeNull() // 因为大文件修改时间变化
    })

    it('应该在文件大小变化时使缓存失效', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'test.txt', 'short')

      await cache.set(testFile, 'cached data')
      expect(await cache.get(testFile)).toBe('cached data')

      // 改变文件大小
      fs.writeFileSync(testFile, 'this is much longer content than before')

      const result = await cache.get(testFile)
      expect(result).toBeNull()
    })

    it('应该在小文件内容未变时忽略单独的修改时间变化', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'test.txt', 'content')
      await cache.set(testFile, 'cached data')

      const currentStat = fs.statSync(testFile)
      fs.utimesSync(
        testFile,
        currentStat.atime,
        new Date(currentStat.mtimeMs + 999),
      )

      const result = await cache.get(testFile)
      expect(result).toBe('cached data')
    })
  })

  describe('TTL (Time To Live) 测试', () => {
    it('应该在TTL过期后使键值缓存失效', async () => {
      const cacheWithCustomKey = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache2'),
        ttlDays: 1 / (24 * 60 * 60 * 100), // 10毫秒
        keyGenerator: () => 'fixed-key',
        autoCleanup: false,
      })

      await cacheWithCustomKey.setByData('test data')

      // 立即获取应该有效
      let result = await cacheWithCustomKey.getByKey('fixed-key')
      expect(result).toBe('test data')

      await waitForCondition(() => {
        const entry = cacheWithCustomKey.memoryCache.get('fixed-key')
        return entry !== undefined && Date.now() - entry.timestamp > entry.ttl
      })

      // 现在应该失效
      result = await cacheWithCustomKey.getByKey('fixed-key')
      expect(result).toBeNull()
    })

    it('应该在cleanup中删除过期缓存', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        ttlDays: 1 / (24 * 60 * 60 * 1000), // 1毫秒
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'test.txt', 'content')
      await cache.set(testFile, 'data')

      await waitForCondition(() =>
        [...cache.memoryCache.values()].every(
          entry => Date.now() - entry.timestamp > entry.ttl,
        ),
      )

      const cleanupResult = await cache.cleanup()

      expect(cleanupResult.removed).toBeGreaterThan(0)
      expect(cache.memoryCache.size).toBe(0)
    })

    it('应该跨实例保留写入时的TTL而不套用读取实例配置', async () => {
      const cacheDir = path.join(tempDir, '.cache-entry-ttl')
      const keyGenerator = () => 'entry-ttl-key'
      const writer = new Cache<string>({
        cacheDir,
        ttlDays: 1 / (24 * 60 * 60 * 100), // 10毫秒
        keyGenerator,
        autoCleanup: false,
      })

      await writer.setByData('short lived')

      await waitForCondition(() => {
        const entry = writer.memoryCache.get('entry-ttl-key')
        return entry !== undefined && Date.now() - entry.timestamp > entry.ttl
      })

      const reader = new Cache<string>({
        cacheDir,
        ttlDays: 365,
        keyGenerator,
        autoCleanup: false,
      })

      expect(await reader.getByKey('entry-ttl-key')).toBeNull()
    })

    it('应该保留未过期的缓存', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        ttlDays: 365, // 很长的TTL
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'test.txt', 'content')
      await cache.set(testFile, 'data')

      const cleanupResult = await cache.cleanup()

      expect(cleanupResult.removed).toBe(0)
      expect(cache.memoryCache.size).toBe(1)
    })
  })

  describe('自定义验证器', () => {
    it('应该调用自定义验证器', async () => {
      let validatorCalled = false
      const validator: CacheValidator<string> = async () => {
        validatorCalled = true
        return true // 总是返回true以保证测试稳定
      }

      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        validator,
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'test.txt', 'content')

      // 设置数据
      await cache.set(testFile, 'test data')

      const result = await cache.get(testFile)

      expect(result).toBe('test data')
      expect(validatorCalled).toBe(true)
    })

    it('应该向自定义验证器提供冻结的条目快照', async () => {
      let entryFrozen = false
      const cache = new Cache<string>({
        cacheDir: path.join(tempDir, '.cache-validator-snapshot'),
        autoCleanup: false,
        validator: entry => {
          entryFrozen = Object.isFrozen(entry)
          return true
        },
      })
      const testFile = createTempFile(tempDir, 'snapshot.txt', 'content')

      await cache.set(testFile, 'data')

      expect(await cache.get(testFile)).toBe('data')
      expect(entryFrozen).toBe(true)
    })

    it('应该处理验证器抛出的异常', async () => {
      const faultyValidator: CacheValidator<string> = async () => {
        throw new Error('Validator error')
      }

      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        validator: faultyValidator,
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'test.txt', 'content')
      await cache.set(testFile, 'data')

      // 即使验证器出错，也不应该崩溃
      const result = await cache.get(testFile)

      // 验证器异常应该被捕获，缓存被视为无效
      expect(result).toBeNull()
      expect(cache.memoryCache.size).toBe(0)
      expect(
        fs
          .readdirSync(cache.cacheDir)
          .filter(file => /^[a-f0-9]{64}\.json$/u.test(file)),
      ).toHaveLength(0)
    })

    it('应该支持同步验证器', async () => {
      const syncValidator: CacheValidator<string> = entry => {
        return entry.data.length > 5
      }

      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        validator: syncValidator,
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'test.txt', 'content')

      // 短数据（无效）
      await cache.set(testFile, 'short')
      let result = await cache.get(testFile)
      expect(result).toBeNull()

      // 长数据（有效）
      await cache.set(testFile, 'longer data')
      result = await cache.get(testFile)
      expect(result).toBe('longer data')
    })
  })

  describe('磁盘缓存持久化', () => {
    it('应该从磁盘加载有效缓存', async () => {
      const cacheDir = path.join(tempDir, '.cache')

      // 第一个缓存实例
      const cache1 = new Cache<string>({
        enabled: true,
        cacheDir,
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'test.txt', 'content')
      await cache1.set(testFile, 'persisted data')

      // 创建新的缓存实例（模拟重启）
      const cache2 = new Cache<string>({
        enabled: true,
        cacheDir,
        autoCleanup: false,
      })

      // 应该能从磁盘加载缓存
      const result = await cache2.get(testFile)
      expect(result).toBe('persisted data')
    })

    it('应该在磁盘缓存损坏时跳过加载', async () => {
      const cacheDir = path.join(tempDir, '.cache')
      fs.mkdirSync(cacheDir, { recursive: true })

      // 创建损坏的缓存文件
      const corruptFile = path.join(cacheDir, `${'a'.repeat(64)}.json`)
      fs.writeFileSync(corruptFile, 'invalid json content')

      const cache = new Cache<string>({
        enabled: true,
        cacheDir,
        autoCleanup: false,
      })

      // 应该能正常初始化，跳过损坏的文件
      const stats = await cache.getStats()
      expect(stats).toBeDefined()
    })

    it('应该拒绝未知版本的缓存文件', async () => {
      const cacheDir = path.join(tempDir, '.cache-version')
      const key = 'versioned-key'
      const fileName = `${crypto.createHash('sha256').update(key).digest('hex')}.json`

      fs.mkdirSync(cacheDir, { recursive: true })
      fs.writeFileSync(
        path.join(cacheDir, fileName),
        JSON.stringify({
          version: '999.0',
          data: 'foreign data',
          metadata: {
            timestamp: Date.now(),
            mtime: 0,
            size: 0,
            hash: '',
            ttl: 1000,
            key,
          },
        }),
      )

      const cache = new Cache<string>({ cacheDir, autoCleanup: false })

      expect(await cache.getByKey(key)).toBeNull()
    })

    it('应该跨实例持久化falsy数据', async () => {
      type FalsyValue = false | 0 | '' | null | undefined
      const cacheDir = path.join(tempDir, '.cache-falsy')
      const keyGenerator = (data: FalsyValue) => {
        if (data === undefined) return 'undefined'
        if (data === null) return 'null'
        return `${typeof data}:${String(data)}`
      }
      const values: FalsyValue[] = [false, 0, '', null, undefined]
      const first = new Cache<FalsyValue>({
        cacheDir,
        keyGenerator,
        autoCleanup: false,
      })
      const keys: string[] = []

      for (const value of values) {
        const key = await first.setByData(value)
        expect(key).not.toBeNull()
        keys.push(key as string)
      }

      const second = new Cache<FalsyValue>({
        cacheDir,
        keyGenerator,
        autoCleanup: false,
      })

      for (let index = 0; index < values.length; index++) {
        const key = keys[index]

        expect(key).toBeDefined()
        expect(await second.getByKey(key as string)).toBe(values[index])
        expect(second.memoryCache.get(key as string)?.data).toBe(values[index])
      }
    })

    it('应该读取并迁移旧版MD5文件名的文件缓存', async () => {
      const cacheDir = path.join(tempDir, '.cache-legacy-name')
      const testFile = createTempFile(tempDir, 'legacy.txt', 'content')
      const normalizedPath = path.resolve(testFile)
      const logicalKey = crypto
        .createHash('md5')
        .update(normalizedPath)
        .digest('hex')
      const currentFileName = `${crypto
        .createHash('sha256')
        .update(logicalKey)
        .digest('hex')}.json`
      const legacyFileName = `${logicalKey}.json`
      const first = new Cache<string>({ cacheDir, autoCleanup: false })

      await first.set(testFile, 'legacy data')
      fs.renameSync(
        path.join(cacheDir, currentFileName),
        path.join(cacheDir, legacyFileName),
      )

      const second = new Cache<string>({ cacheDir, autoCleanup: false })

      expect(await second.get(testFile)).toBe('legacy data')
      expect(fs.existsSync(path.join(cacheDir, currentFileName))).toBe(true)
      expect(fs.existsSync(path.join(cacheDir, legacyFileName))).toBe(false)
    })
  })
})
