import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Cache } from '../src'
import {
  cleanupDir,
  createTempDir,
  createTempFile,
  waitForCondition,
} from './test-utils'

describe('Cache 性能和清理功能测试', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempDir('cache-performance-test-')
  })

  afterEach(() => {
    cleanupDir(tempDir)
  })

  describe('性能测试', () => {
    it('应该快速处理大量缓存操作', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      const startTime = Date.now()
      const operations = 100
      const promises = []

      // 创建大量文件和缓存操作
      for (let i = 0; i < operations; i++) {
        const testFile = createTempFile(
          tempDir,
          `perf-test-${i}.txt`,
          `content-${i}`,
        )
        promises.push(cache.set(testFile, `data-${i}`))
      }

      await Promise.all(promises)

      // 执行大量get操作
      const getPromises = []
      for (let i = 0; i < operations; i++) {
        const testFile = path.join(tempDir, `perf-test-${i}.txt`)
        getPromises.push(cache.get(testFile))
      }

      await Promise.all(getPromises)

      const endTime = Date.now()
      const totalTime = endTime - startTime

      // 100个操作应该在合理时间内完成（比如5秒）
      expect(totalTime).toBeLessThan(5000)
      expect(cache.stats.hits).toBe(operations)
    }, 10000)

    it('应该在首次磁盘读取后复用内存缓存', async () => {
      const cacheDir = path.join(tempDir, '.cache')
      const reader = new Cache<string>({
        enabled: true,
        cacheDir,
        autoCleanup: false,
      })
      await reader.getStats()

      const writer = new Cache<string>({
        enabled: true,
        cacheDir,
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'speed-test.txt', 'content')
      await writer.set(testFile, 'test data')

      // reader 在写入前已经初始化，第一次获取只能从磁盘加载
      expect(reader.memoryCache.size).toBe(0)
      await reader.get(testFile)

      // 第二次get（从内存）
      const result = await reader.get(testFile)

      expect(result).toBe('test data')
      expect(reader.memoryCache.size).toBe(1)
    })

    it('应该高效处理大文件的哈希计算', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      // 创建大文件（1MB）
      const largeContent = 'x'.repeat(1024 * 1024)
      const largeFile = createTempFile(tempDir, 'large.txt', largeContent)

      const startTime = Date.now()
      await cache.set(largeFile, 'large file data')
      const setTime = Date.now() - startTime

      // 大文件处理应该在合理时间内完成
      expect(setTime).toBeLessThan(1000) // 1秒内

      const getStart = Date.now()
      const result = await cache.get(largeFile)
      const getTime = Date.now() - getStart

      expect(result).toBe('large file data')
      expect(getTime).toBeLessThan(100) // 从内存读取应该很快
    })
  })

  describe('清理功能测试', () => {
    it('应该根据TTL清理过期文件', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        ttlDays: 1 / (24 * 60 * 60 * 1000), // 1毫秒
        autoCleanup: false,
      })

      // 创建一些缓存文件
      const files = []
      for (let i = 0; i < 5; i++) {
        const testFile = createTempFile(
          tempDir,
          `expire-${i}.txt`,
          `content-${i}`,
        )
        files.push(testFile)
        await cache.set(testFile, `data-${i}`)
      }

      expect(cache.memoryCache.size).toBe(5)

      await waitForCondition(() =>
        [...cache.memoryCache.values()].every(
          entry => Date.now() - entry.timestamp > entry.ttl,
        ),
      )

      const cleanupResult = await cache.cleanup()

      expect(cleanupResult.removed).toBe(5)
      expect(cleanupResult.totalSize).toBeGreaterThan(0)
      expect(cache.memoryCache.size).toBe(0)
    })

    it('应该根据文件数量限制清理', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        maxFiles: 3,
        ttlDays: 365, // 很长的TTL，不会因时间过期
        autoCleanup: false,
      })

      // 创建超过限制的缓存文件
      for (let i = 0; i < 5; i++) {
        const testFile = createTempFile(
          tempDir,
          `limit-${i}.txt`,
          `content-${i}`,
        )
        await cache.set(testFile, `data-${i}`)
      }

      const cleanupResult = await cache.cleanup()

      // 写入阶段已经持续执行数量限制，手动清理无需再次删除
      expect(cleanupResult.removed).toBe(0)
      expect(cache.memoryCache.size).toBe(3)
      expect(
        fs
          .readdirSync(cache.cacheDir)
          .filter(file => /^[a-f0-9]{64}\.json$/u.test(file)),
      ).toHaveLength(3)
    })

    it('磁盘已有文件时应该按需加载并持续执行数量限制', async () => {
      const cacheDir = path.join(tempDir, '.cache-existing-limit')
      const keyGenerator = (data: string) => data
      const writer = new Cache<string>({
        cacheDir,
        maxFiles: 100,
        keyGenerator,
        autoCleanup: false,
      })

      for (let index = 0; index < 51; index++) {
        await writer.setByData(`existing-${index}`)
      }

      const reader = new Cache<string>({
        cacheDir,
        maxFiles: 51,
        keyGenerator,
        autoCleanup: false,
      })

      expect((await reader.getStats()).files).toBe(51)
      expect(reader.memoryCache.size).toBe(0)
      expect(await reader.getByKey('existing-0')).toBe('existing-0')
      expect(reader.memoryCache.size).toBe(1)

      await reader.setByData('new-entry')

      expect(
        fs
          .readdirSync(cacheDir)
          .filter(file => /^[a-f0-9]{64}\.json$/u.test(file)),
      ).toHaveLength(51)
    })

    it('达到文件上限后一次收敛只应该扫描一次目录', async () => {
      const cacheDir = path.join(tempDir, '.cache-single-scan-limit')
      const cache = new Cache<string>({
        cacheDir,
        maxFiles: 2,
        keyGenerator: data => data,
        autoCleanup: false,
      })
      await cache.getStats()
      const readdirSpy = vi.spyOn(fs.promises, 'readdir')

      await cache.setByData('first')
      await cache.setByData('second')
      await cache.setByData('third')

      const cacheDirectoryScans = readdirSpy.mock.calls.filter(
        ([directory]) => directory === cacheDir,
      )

      expect(cacheDirectoryScans).toHaveLength(1)
      expect(cache.stats.files).toBe(2)
    })

    it('应该清理无效的缓存文件', async () => {
      const cacheDir = path.join(tempDir, '.cache')
      fs.mkdirSync(cacheDir, { recursive: true })

      // 创建无效的缓存文件
      fs.writeFileSync(
        path.join(cacheDir, `${'a'.repeat(64)}.json`),
        'invalid json',
      )
      fs.writeFileSync(
        path.join(cacheDir, `${'b'.repeat(64)}.json`),
        JSON.stringify({ incomplete: 'data' }),
      )

      const cache = new Cache<string>({
        enabled: true,
        cacheDir,
        autoCleanup: false,
      })

      const cleanupResult = await cache.cleanup()

      expect(cleanupResult.removed).toBe(2)
      expect(cleanupResult.errors).toHaveLength(0) // 应该成功清理
    })

    it('应该回收过旧的原子写入临时文件并保留新文件', async () => {
      const cacheDir = path.join(tempDir, '.cache-temporary-files')
      fs.mkdirSync(cacheDir, { recursive: true })
      const staleFile = path.join(
        cacheDir,
        `${'a'.repeat(64)}.json.${process.pid}.${crypto.randomUUID()}.tmp`,
      )
      const freshFile = path.join(
        cacheDir,
        `${'b'.repeat(64)}.json.${process.pid}.${crypto.randomUUID()}.tmp`,
      )

      fs.writeFileSync(staleFile, 'stale')
      fs.writeFileSync(freshFile, 'fresh')
      const staleTime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      fs.utimesSync(staleFile, staleTime, staleTime)

      const cache = new Cache<string>({ cacheDir, autoCleanup: false })
      const cleanupResult = await cache.cleanup()

      expect(cleanupResult.removed).toBe(1)
      expect(fs.existsSync(staleFile)).toBe(false)
      expect(fs.existsSync(freshFile)).toBe(true)
      expect((await cache.getStats()).files).toBe(0)

      await cache.clear()
      expect(fs.existsSync(freshFile)).toBe(false)
    })

    it('应该在cleanup中处理文件访问错误', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      // 创建一个正常的缓存文件
      const testFile = createTempFile(tempDir, 'normal.txt', 'content')
      await cache.set(testFile, 'data')

      // 在缓存目录中创建一个我们无法删除的文件（模拟权限错误）
      const cacheDir = path.join(tempDir, '.cache')
      const protectedFile = path.join(cacheDir, 'protected.json')
      fs.writeFileSync(protectedFile, JSON.stringify({ test: 'data' }))

      // 在不同平台上模拟权限错误可能不同，这里主要测试错误处理逻辑
      const cleanupResult = await cache.cleanup()

      // 应该有清理结果，可能包含错误
      expect(cleanupResult).toHaveProperty('removed')
      expect(cleanupResult).toHaveProperty('errors')
      expect(Array.isArray(cleanupResult.errors)).toBe(true)
    })

    it('应该在自动清理启用时自动执行清理', async () => {
      const cacheDir = path.join(tempDir, '.cache')
      const writer = new Cache<string>({
        enabled: true,
        cacheDir,
        autoCleanup: false,
        ttlDays: 1 / (24 * 60 * 60 * 1000), // 1毫秒
      })

      const testFile = createTempFile(tempDir, 'auto-clean.txt', 'content')
      await writer.set(testFile, 'data')
      await waitForCondition(() =>
        [...writer.memoryCache.values()].every(
          entry => Date.now() - entry.timestamp > entry.ttl,
        ),
      )

      const reader = new Cache<string>({
        enabled: true,
        cacheDir,
        autoCleanup: true,
        ttlDays: 1 / (24 * 60 * 60 * 1000),
      })

      await reader.getStats()
      await waitForCondition(
        () =>
          fs
            .readdirSync(cacheDir)
            .filter(file => /^[a-f0-9]{64}\.json$/u.test(file)).length === 0,
      )

      expect(reader.memoryCache.size).toBe(0)
      expect(
        fs
          .readdirSync(cacheDir)
          .filter(file => /^[a-f0-9]{64}\.json$/u.test(file)),
      ).toHaveLength(0)
    })
  })

  describe('统计信息和监控', () => {
    it('应该准确计算磁盘使用量', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      // 创建一些缓存文件
      const testFile1 = createTempFile(tempDir, 'disk1.txt', 'content1')
      const testFile2 = createTempFile(tempDir, 'disk2.txt', 'content2')

      await cache.set(testFile1, 'data1')
      await cache.set(testFile2, 'data2')
      fs.writeFileSync(
        path.join(cache.cacheDir, 'foreign.bin'),
        'x'.repeat(1000),
      )

      const stats = await cache.getStats()
      const managedDiskUsage = fs
        .readdirSync(cache.cacheDir)
        .filter(file => /^[a-f0-9]{64}\.json$/u.test(file))
        .reduce(
          (total, file) =>
            total + fs.statSync(path.join(cache.cacheDir, file)).size,
          0,
        )

      expect(stats.diskUsage).toBe(managedDiskUsage)
      expect(cache.stats.diskUsage).toBe(managedDiskUsage)
      expect(stats.files).toBe(2)
    })

    it('应该正确更新命中率统计', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'hit-rate.txt', 'content')

      // 2次命中，1次未命中
      await cache.set(testFile, 'data')
      await cache.get(testFile) // hit
      await cache.get(testFile) // hit
      await cache.get('/nonexistent.txt') // miss

      expect(cache.stats.hits).toBe(2)
      expect(cache.stats.misses).toBe(1)
      expect(cache.stats.hitRate).toBeCloseTo(2 / 3, 2)
    })

    it('应该在清空后重置统计信息', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'clear-stats.txt', 'content')
      await cache.set(testFile, 'data')
      await cache.get(testFile)

      expect(cache.stats.hits).toBe(1)
      expect(cache.memoryCache.size).toBe(1)

      await cache.clear()

      expect(cache.memoryCache.size).toBe(0)
      // 注意：clear方法不会重置命中统计，这是设计决定
      expect(cache.stats.hits).toBe(1) // 保持原有统计
    })
  })

  describe('内存效率', () => {
    it('应该有效管理内存中的缓存条目', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      // 创建大量小缓存条目
      for (let i = 0; i < 50; i++) {
        const testFile = createTempFile(
          tempDir,
          `memory-${i}.txt`,
          `content-${i}`,
        )
        await cache.set(testFile, `data-${i}`)
      }

      expect(cache.memoryCache.size).toBe(50)

      // 清空缓存
      await cache.clear()

      expect(cache.memoryCache.size).toBe(0)
    })

    it('应该避免内存泄漏在重复操作中', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'leak-test.txt', 'content')

      // 重复相同操作多次，验证没有崩溃
      for (let i = 0; i < 100; i++) {
        await cache.set(testFile, `data-${i}`)
        await cache.get(testFile)
      }

      // 验证最终状态
      expect(cache.memoryCache.size).toBe(1)
    })
  })

  describe('并发性能', () => {
    it('应该处理高并发读写操作', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      const concurrency = 20
      const operationsPerWorker = 10
      const promises = []

      // 创建并发工作者
      for (let worker = 0; worker < concurrency; worker++) {
        const workerPromise = async () => {
          for (let op = 0; op < operationsPerWorker; op++) {
            const testFile = createTempFile(
              tempDir,
              `concurrent-${worker}-${op}.txt`,
              `content-${worker}-${op}`,
            )
            await cache.set(testFile, `data-${worker}-${op}`)
            await cache.get(testFile)
          }
        }
        promises.push(workerPromise())
      }

      const startTime = Date.now()
      await Promise.all(promises)
      const endTime = Date.now()

      // 所有并发操作应该在合理时间内完成
      expect(endTime - startTime).toBeLessThan(5000) // 5秒
      expect(cache.stats.hits).toBe(concurrency * operationsPerWorker)
    }, 10000)
  })
})
