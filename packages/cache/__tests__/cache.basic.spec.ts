import * as fs from 'node:fs'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { Cache, CacheOptions } from '../src'
import { cleanupDir, createTempDir, createTempFile } from './test-utils'

describe('Cache 基础功能测试', () => {
  let tempDir: string
  let cache: Cache<string>

  beforeEach(() => {
    tempDir = createTempDir('cache-test-')
    cache = new Cache<string>({
      enabled: true,
      cacheDir: path.join(tempDir, '.cache'),
      ttlDays: 1,
      autoCleanup: false,
    })
  })

  afterEach(() => {
    cleanupDir(tempDir)
  })

  describe('构造函数和初始化', () => {
    it('应该使用默认选项创建缓存实例', () => {
      const defaultCache = new Cache()

      expect(defaultCache.options.enabled).toBe(true)
      expect(defaultCache.options.ttlDays).toBe(7)
      expect(defaultCache.options.autoCleanup).toBe(true)
      expect(defaultCache.options.maxFiles).toBe(1000)
      expect(defaultCache.options.cacheDir).toContain('.eljs-cache')
    })

    it('应该使用自定义选项创建缓存实例', () => {
      const customOptions: CacheOptions<string> = {
        enabled: false,
        cacheDir: '/custom/cache',
        ttlDays: 30,
        autoCleanup: false,
        maxFiles: 500,
      }

      const customCache = new Cache(customOptions)

      expect(customCache.options.enabled).toBe(false)
      expect(customCache.options.cacheDir).toBe('/custom/cache')
      expect(customCache.options.ttlDays).toBe(30)
      expect(customCache.options.autoCleanup).toBe(false)
      expect(customCache.options.maxFiles).toBe(500)
    })

    it('应该正确初始化统计信息', () => {
      expect(cache.stats).toEqual({
        hits: 0,
        misses: 0,
        files: 0,
        hitRate: 0,
        diskUsage: 0,
      })
      expect(Object.isFrozen(cache.options)).toBe(true)
    })

    it('初始时应该未初始化', () => {
      expect(cache.initialized).toBe(false)
    })
  })

  describe('基本缓存操作', () => {
    it('应该能设置和获取文件缓存', async () => {
      const testFile = createTempFile(tempDir, 'test.txt', 'test content')
      const testData = 'cached data'

      // 设置缓存
      await cache.set(testFile, testData)

      // 验证设置后状态
      expect(cache.initialized).toBe(true)
      expect(cache.memoryCache.size).toBe(1)

      // 获取缓存
      const result = await cache.get(testFile)
      expect(result).toBe(testData)

      // 验证统计信息
      expect(cache.stats.hits).toBe(1)
      expect(cache.stats.misses).toBe(0)
    })

    it('应该在文件不存在时返回null并记录miss', async () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.txt')

      const result = await cache.get(nonExistentFile)

      expect(result).toBeNull()
      expect(cache.stats.misses).toBe(1)
      expect(cache.stats.hits).toBe(0)
    })

    it('应该能通过键设置和获取缓存', async () => {
      const testData = 'test data by key'
      const testKey = 'test-key'

      // 通过数据设置缓存
      await cache.setByData(testData)

      // 通过键获取缓存
      const result = await cache.getByKey('some-key')
      expect(result).toBeNull() // 因为键不同

      // 使用自定义键生成器
      const customCache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache2'),
        keyGenerator: () => testKey,
      })

      const generatedKey = await customCache.setByData(testData)
      expect(generatedKey).toBe(testKey)
      const customResult = await customCache.getByKey(testKey)
      expect(customResult).toBe(testData)
    })

    it('默认键应该区分值类型并忽略对象属性插入顺序', async () => {
      type KeyData = number | string | { first: number; second: number }
      const defaultKeyCache = new Cache<KeyData>({
        cacheDir: path.join(tempDir, '.cache-default-key'),
        autoCleanup: false,
      })

      const numberKey = await defaultKeyCache.setByData(1)
      const stringKey = await defaultKeyCache.setByData('1')
      const firstObjectKey = await defaultKeyCache.setByData({
        first: 1,
        second: 2,
      })
      const reorderedObjectKey = await defaultKeyCache.setByData({
        second: 2,
        first: 1,
      })

      expect(numberKey).not.toBe(stringKey)
      expect(firstObjectKey).toBe(reorderedObjectKey)
      expect(await defaultKeyCache.getByKey(numberKey as string)).toBe(1)
      expect(await defaultKeyCache.getByKey(stringKey as string)).toBe('1')
    })

    it('默认键应该明确拒绝循环引用', async () => {
      interface CircularData {
        self?: CircularData
      }

      const defaultKeyCache = new Cache<CircularData>({
        cacheDir: path.join(tempDir, '.cache-circular-key'),
        autoCleanup: false,
      })
      const circularData: CircularData = {}
      circularData.self = circularData

      await expect(defaultKeyCache.setByData(circularData)).rejects.toThrow(
        TypeError,
      )
    })

    it('默认键应该覆盖特殊值并拒绝不可确定的数据', async () => {
      const defaultKeyCache = new Cache<unknown>({
        cacheDir: path.join(tempDir, '.cache-special-key'),
        autoCleanup: false,
        serializer: {
          serialize: data =>
            typeof data === 'bigint' ? { bigint: String(data) } : data,
          deserialize: data => data,
        },
      })
      const sparseArray = new Array<unknown>(1)
      const explicitUndefined = [undefined]
      const keys = await Promise.all([
        defaultKeyCache.setByData(undefined),
        defaultKeyCache.setByData(null),
        defaultKeyCache.setByData(true),
        defaultKeyCache.setByData(-0),
        defaultKeyCache.setByData(Number.NaN),
        defaultKeyCache.setByData(1n),
        defaultKeyCache.setByData(sparseArray),
        defaultKeyCache.setByData(explicitUndefined),
        defaultKeyCache.setByData(new Date('2026-01-01T00:00:00.000Z')),
      ])

      expect(new Set(keys).size).toBe(keys.length)
      await expect(defaultKeyCache.setByData(() => undefined)).rejects.toThrow(
        TypeError,
      )
      await expect(
        defaultKeyCache.setByData(Symbol('unsupported')),
      ).rejects.toThrow(TypeError)

      const symbolProperty = { visible: true } as Record<
        string | symbol,
        boolean
      >
      symbolProperty[Symbol('unsupported')] = true
      await expect(defaultKeyCache.setByData(symbolProperty)).rejects.toThrow(
        TypeError,
      )
      await expect(
        defaultKeyCache.setByData(new Map([['key', 'value']])),
      ).rejects.toThrow(TypeError)
    })

    it('应该将同一文件的相对路径和绝对路径视为同一缓存', async () => {
      const testFile = createTempFile(tempDir, 'normalized.txt', 'content')
      const relativePath = path.relative(process.cwd(), testFile)

      await cache.set(relativePath, 'normalized data')

      expect(await cache.get(testFile)).toBe('normalized data')
      expect(cache.memoryCache.size).toBe(1)
    })

    it('应该在缓存禁用时返回null', async () => {
      const disabledCache = new Cache<string>({ enabled: false })
      const testFile = createTempFile(tempDir, 'test.txt', 'content')

      await disabledCache.set(testFile, 'data')
      const result = await disabledCache.get(testFile)

      expect(result).toBeNull()
      expect(disabledCache.initialized).toBe(false)
    })
  })

  describe('缓存验证', () => {
    it('应该在文件修改后使缓存失效', async () => {
      const testFile = createTempFile(tempDir, 'test.txt', 'original content')
      const testData = 'cached data'

      // 设置缓存
      await cache.set(testFile, testData)

      // 验证缓存有效
      let result = await cache.get(testFile)
      expect(result).toBe(testData)

      fs.writeFileSync(testFile, 'modified content')

      // 缓存应该失效
      result = await cache.get(testFile)
      expect(result).toBeNull()
      expect(cache.stats.misses).toBe(1)
    })

    it('应该在文件大小改变后使缓存失效', async () => {
      const testFile = createTempFile(tempDir, 'test.txt', 'short')
      const testData = 'cached data'

      await cache.set(testFile, testData)

      // 修改文件大小
      fs.writeFileSync(testFile, 'this is much longer content')

      const result = await cache.get(testFile)
      expect(result).toBeNull()
    })

    it('应该使用自定义验证器', async () => {
      let validatorCalled = false
      const customCache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache-validator'),
        validator: async () => {
          validatorCalled = true
          return false // 总是返回无效
        },
      })

      const testFile = createTempFile(tempDir, 'test.txt', 'content')
      await customCache.set(testFile, 'data')

      const result = await customCache.get(testFile)

      expect(validatorCalled).toBe(true)
      expect(result).toBeNull()
    })
  })

  describe('统计信息', () => {
    it('应该正确计算命中率', async () => {
      const testFile = createTempFile(tempDir, 'test.txt', 'content')

      // 一次命中，两次未命中
      await cache.set(testFile, 'data')
      await cache.get(testFile) // hit
      await cache.get('nonexistent1') // miss
      await cache.get('nonexistent2') // miss

      expect(cache.stats.hits).toBe(1)
      expect(cache.stats.misses).toBe(2)
      expect(cache.stats.hitRate).toBeCloseTo(1 / 3, 2)
    })

    it('应该返回正确的缓存统计信息', async () => {
      const testFile1 = createTempFile(tempDir, 'test1.txt', 'content1')
      const testFile2 = createTempFile(tempDir, 'test2.txt', 'content2')

      await cache.set(testFile1, 'data1')
      await cache.set(testFile2, 'data2')

      const stats = await cache.getStats()

      expect(stats.files).toBe(2)
      expect(stats.diskUsage).toBeGreaterThan(0)
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.hitRate).toBe(0)
    })
  })

  describe('缓存清理', () => {
    it('应该能清空所有缓存', async () => {
      const testFile1 = createTempFile(tempDir, 'test1.txt', 'content1')
      const testFile2 = createTempFile(tempDir, 'test2.txt', 'content2')

      await cache.set(testFile1, 'data1')
      await cache.set(testFile2, 'data2')

      expect(cache.memoryCache.size).toBe(2)

      await cache.clear()

      expect(cache.memoryCache.size).toBe(0)
    })

    it('清空缓存时应该保留不属于缓存管理的文件', async () => {
      const testFile = createTempFile(tempDir, 'test.txt', 'content')
      await cache.set(testFile, 'data')

      const unrelatedFile = path.join(cache.cacheDir, 'unrelated.json')
      fs.writeFileSync(unrelatedFile, '{"owned":false}')

      await cache.clear()

      expect(fs.existsSync(unrelatedFile)).toBe(true)
      expect(
        fs
          .readdirSync(cache.cacheDir)
          .filter(file => /^[a-f0-9]{64}\.json$/u.test(file)),
      ).toHaveLength(0)
    })

    it('应该进行清理操作并返回结果', async () => {
      const testFile = createTempFile(tempDir, 'test.txt', 'content')
      await cache.set(testFile, 'data')

      const result = await cache.cleanup()

      expect(result).toHaveProperty('removed')
      expect(result).toHaveProperty('totalSize')
      expect(result).toHaveProperty('errors')
      expect(Array.isArray(result.errors)).toBe(true)
    })
  })
})
