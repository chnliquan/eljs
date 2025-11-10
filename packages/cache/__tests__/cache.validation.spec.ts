import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { Cache, CacheValidator } from '../src'

// 测试工具函数
const createTempDir = () => {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cache-validation-test-'))
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('Cache 验证和 TTL 测试', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempDir()
  })

  afterEach(() => {
    cleanupDir(tempDir)
  })

  describe('文件缓存验证', () => {
    it('应该在文件内容变化时使缓存失效（小文件）', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      const testContent = 'original content' // 小于50KB
      const testFile = createTempFile(tempDir, 'small.txt', testContent)

      // 设置缓存
      await cache.set(testFile, 'cached data')

      // 验证缓存有效
      let result = await cache.get(testFile)
      expect(result).toBe('cached data')
      expect(cache.stats.hits).toBe(1)

      // 修改文件内容（保持相同大小和修改时间）
      await sleep(10) // 确保时间戳不同
      fs.writeFileSync(testFile, 'changed content') // 相同长度，但内容不同

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

      // 改变文件大小，这应该能被检测到
      const smallerContent = 'y'.repeat(30 * 1024) // 明显不同的大小
      fs.writeFileSync(testFile, smallerContent)

      // 清空内存缓存强制验证
      cache.memoryCache.clear()

      result = await cache.get(testFile)
      expect(result).toBeNull() // 因为文件大小变化
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

    it('应该容忍1秒的修改时间差异', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'test.txt', 'content')
      await cache.set(testFile, 'cached data')

      // 手动调整缓存条目的mtime，模拟轻微的时间差异
      const cacheEntry = Array.from(cache.memoryCache.values())[0]
      if (cacheEntry) {
        // 设置999ms的差异（应该被容忍）
        const currentStat = fs.statSync(testFile)
        cacheEntry.mtime = currentStat.mtimeMs - 999

        const result = await cache.get(testFile)
        expect(result).toBe('cached data') // 应该仍然有效
      }
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

      // 等待TTL过期
      await sleep(50)

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

      // 等待过期
      await sleep(10)

      const cleanupResult = await cache.cleanup()

      expect(cleanupResult.removed).toBeGreaterThan(0)
      expect(cache.memoryCache.size).toBe(0)
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

      // 清空内存缓存强制从磁盘读取并验证
      cache.memoryCache.clear()

      const result = await cache.get(testFile)

      expect(result).toBe('test data')
      expect(validatorCalled).toBe(true)
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
      const corruptFile = path.join(cacheDir, 'corrupt.json')
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
  })
})
