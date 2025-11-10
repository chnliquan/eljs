import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { Cache, CacheOptions } from '../src'

// 测试工具函数
const createTempDir = () => {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cache-test-'))
}

const createTempFile = (dir: string, filename: string, content: string) => {
  const filePath = path.join(dir, filename)
  fs.writeFileSync(filePath, content)
  return filePath
}

const cleanupDir = (dir: string) => {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // 忽略清理错误
  }
}

describe('Cache 基础功能测试', () => {
  let tempDir: string
  let cache: Cache<string>

  beforeEach(() => {
    tempDir = createTempDir()
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

      await customCache.setByData(testData)
      const customResult = await customCache.getByKey(testKey)
      expect(customResult).toBe(testData)
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

      // 等待一段时间后修改文件
      await new Promise(resolve => setTimeout(resolve, 10))
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
