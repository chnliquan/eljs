import * as fs from 'node:fs'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Cache } from '../src'
import {
  cleanupDir,
  createBlockedDirectoryPath,
  createTempDir,
  createTempFile,
} from './test-utils'

describe('Cache 并发初始化测试', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempDir('cache-concurrent-test-')
  })

  afterEach(() => {
    cleanupDir(tempDir)
  })

  describe('并发初始化防护', () => {
    it('应该防止重复初始化', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      // 并发调用多个需要初始化的方法
      const promises = [
        cache.get('/nonexistent/file1.txt'),
        cache.get('/nonexistent/file2.txt'),
        cache.getStats(),
        cache.getByKey('test-key'),
        cache.setByData('test-data', { timestamp: Date.now() }),
      ]

      await Promise.all(promises)

      // 验证初始化完成
      expect(cache.initialized).toBe(true)
    })

    it('应该正确处理构造函数和方法调用的初始化竞争', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      // 立即调用方法（此时构造函数中的初始化可能还在进行）
      const testFile = createTempFile(tempDir, 'test.txt', 'content')

      // 同时发起多个调用
      const results = await Promise.all([
        cache.get(testFile),
        cache.getStats(),
        cache.get('/another/file.txt'),
      ])

      // 验证初始化完成且结果正确
      expect(cache.initialized).toBe(true)
      expect(results[0]).toBeNull() // 文件缓存不存在
      expect(results[1]).toBeDefined() // 统计信息
      expect(results[2]).toBeNull() // 文件不存在
    })

    it('应该在初始化失败后正确处理状态', async () => {
      // 使用无效路径强制初始化失败
      const blockedCacheDir = createBlockedDirectoryPath(tempDir)
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: blockedCacheDir,
        autoCleanup: false,
      })

      // 尝试使用缓存
      const result = await cache.get('/some/file.txt')

      // 应该返回null且不会崩溃
      expect(result).toBeNull()
    })
  })

  describe('初始化时序', () => {
    it('应该在构造后立即开始初始化', () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      // 构造完成后初始化应该还未完成
      expect(cache.initialized).toBe(false)
    })

    it('应该在禁用缓存时跳过初始化', async () => {
      const cache = new Cache<string>({
        enabled: false,
        cacheDir: path.join(tempDir, '.cache'),
      })

      await cache.get('/some/file.txt')

      // 应该保持未初始化状态
      expect(cache.initialized).toBe(false)
    })
  })

  describe('错误恢复', () => {
    it('初始目录计数失败时仍应该保留内存缓存能力', async () => {
      const cacheDir = path.join(tempDir, '.cache-count-failure')
      const readdirSpy = vi
        .spyOn(fs.promises, 'readdir')
        .mockRejectedValueOnce(new Error('scan failed'))
      const cache = new Cache<string>({ cacheDir, autoCleanup: false })

      const key = await cache.setByData('memory data')

      expect(cache.enabled).toBe(true)
      expect(key).not.toBeNull()
      expect(await cache.getByKey(key as string)).toBe('memory data')
      readdirSpy.mockRestore()
    })

    it('初始目录计数失败后应该在首次写入时重新收敛文件上限', async () => {
      const cacheDir = path.join(tempDir, '.cache-count-recovery')
      const writer = new Cache<string>({
        cacheDir,
        maxFiles: 10,
        keyGenerator: data => data,
        autoCleanup: false,
      })
      await writer.setByData('existing-1')
      await writer.setByData('existing-2')
      await writer.setByData('existing-3')

      const readdirSpy = vi
        .spyOn(fs.promises, 'readdir')
        .mockRejectedValueOnce(new Error('scan failed'))
      const cache = new Cache<string>({
        cacheDir,
        maxFiles: 1,
        keyGenerator: data => data,
        autoCleanup: false,
      })

      await cache.setByData('new-entry')

      const cacheFiles = (await fs.promises.readdir(cacheDir)).filter(file =>
        file.endsWith('.json'),
      )
      expect(cacheFiles).toHaveLength(1)
      expect(cache.stats.files).toBe(1)
      readdirSpy.mockRestore()
    })

    it('应该在初始化错误后清理Promise状态', async () => {
      const blockedCacheDir = createBlockedDirectoryPath(tempDir)
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: blockedCacheDir,
        autoCleanup: false,
      })

      // 第一次调用会失败并禁用缓存
      await cache.get('/some/file.txt')

      // 验证公开状态
      expect(cache.options.enabled).toBe(true)
      expect(cache.enabled).toBe(false)
    })

    it('应该在初始化失败后所有后续调用都返回null', async () => {
      const blockedCacheDir = createBlockedDirectoryPath(tempDir)
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: blockedCacheDir,
        autoCleanup: false,
      })

      // 多次调用都应该返回null
      const results = await Promise.all([
        cache.get('/file1.txt'),
        cache.get('/file2.txt'),
        cache.getByKey('key1'),
        cache.getByKey('key2'),
      ])

      expect(results).toEqual([null, null, null, null])
    })
  })

  describe('内存和资源管理', () => {
    it('应该在初始化完成后保持可用', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      // 确保初始化完成
      await cache.getStats()

      expect(cache.initialized).toBe(true)
      expect(cache.enabled).toBe(true)
    })

    it('应该支持重复的缓存操作而不重新初始化', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'test.txt', 'content')

      // 第一轮操作
      await cache.set(testFile, 'data1')
      const result1 = await cache.get(testFile)

      // 第二轮操作
      await cache.set(testFile, 'data2')
      const result2 = await cache.get(testFile)

      expect(result1).toBe('data1')
      expect(result2).toBe('data2')
      expect(cache.initialized).toBe(true)
    })

    it('应该保持同一键并发写入的发布顺序', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache-order'),
        autoCleanup: false,
        keyGenerator: () => 'shared-key',
      })

      await Promise.all(
        Array.from({ length: 20 }, (_, index) =>
          cache.setByData(`data-${index}`),
        ),
      )

      expect(await cache.getByKey('shared-key')).toBe('data-19')

      const reloaded = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache-order'),
        autoCleanup: false,
        keyGenerator: () => 'shared-key',
      })

      expect(await reloaded.getByKey('shared-key')).toBe('data-19')
    })

    it('应该让clear覆盖已经发起但尚未完成的写入', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache-clear-race'),
        autoCleanup: false,
      })
      const testFile = createTempFile(tempDir, 'clear-race.txt', 'content')

      const setPromise = cache.set(testFile, 'data')
      const clearPromise = cache.clear()

      await Promise.all([setPromise, clearPromise])

      expect(cache.memoryCache.size).toBe(0)
      expect(
        fs
          .readdirSync(cache.cacheDir)
          .filter(file => /^[a-f0-9]{64}\.json$/u.test(file)),
      ).toHaveLength(0)
    })

    it('应该等待已经进入持久化阶段的写入后再完成clear', async () => {
      const cacheDir = path.join(tempDir, '.cache-clear-persistence-race')
      const cache = new Cache<string>({
        cacheDir,
        autoCleanup: false,
        keyGenerator: data => data,
        maxFiles: 1,
      })
      await cache.getStats()
      await cache.setByData('existing-data')

      let releaseAccess: (() => void) | undefined
      let markAccessStarted: (() => void) | undefined
      const accessStarted = new Promise<void>(resolve => {
        markAccessStarted = resolve
      })
      const accessGate = new Promise<void>(resolve => {
        releaseAccess = resolve
      })
      const accessError = Object.assign(new Error('not found'), {
        code: 'ENOENT',
      })
      const accessSpy = vi
        .spyOn(fs.promises, 'access')
        .mockImplementationOnce(async () => {
          markAccessStarted?.()
          await accessGate
          throw accessError
        })

      const setPromise = cache.setByData('new-data')
      await accessStarted
      const clearPromise = cache.clear()
      releaseAccess?.()

      await Promise.all([setPromise, clearPromise])
      accessSpy.mockRestore()

      expect(cache.memoryCache.size).toBe(0)
      expect(
        fs
          .readdirSync(cacheDir)
          .filter(file => /^[a-f0-9]{64}\.json$/u.test(file)),
      ).toHaveLength(0)
    })

    it('cleanup 与 clear 同时启动时不应该循环等待', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache-cleanup-clear'),
        autoCleanup: false,
      })
      const testFile = createTempFile(tempDir, 'cleanup-clear.txt', 'content')
      await cache.set(testFile, 'data')

      const cleanupPromise = cache.cleanup()
      const clearPromise = cache.clear()
      const [cleanupResult] = await Promise.all([cleanupPromise, clearPromise])

      expect(cleanupResult.errors).toEqual([])
      expect(cache.memoryCache.size).toBe(0)
      expect(
        fs
          .readdirSync(cache.cacheDir)
          .filter(file => /^[a-f0-9]{64}\.json$/u.test(file)),
      ).toHaveLength(0)
    })

    it('应该让清理开始后的同实例写入等待目录扫描完成', async () => {
      const serialize = vi.fn((data: string) => data)
      const cache = new Cache<string>({
        cacheDir: path.join(tempDir, '.cache-cleanup-write'),
        autoCleanup: false,
        keyGenerator: () => 'shared-key',
        serializer: {
          serialize,
          deserialize: data => data as string,
        },
      })
      await cache.setByData('expired-data', { timestamp: 0 })
      serialize.mockClear()

      let markReadStarted: (() => void) | undefined
      let releaseRead: (() => void) | undefined
      const readStarted = new Promise<void>(resolve => {
        markReadStarted = resolve
      })
      const readGate = new Promise<void>(resolve => {
        releaseRead = resolve
      })
      const readFileSpy = vi
        .spyOn(fs.promises, 'readFile')
        .mockImplementationOnce(async filePath => {
          markReadStarted?.()
          await readGate

          if (typeof filePath !== 'string') {
            throw new TypeError('Expected cleanup to read a string path')
          }

          return fs.readFileSync(filePath, 'utf8')
        })
      const cleanupPromise = cache.cleanup()
      await readStarted
      const setPromise = cache.setByData('fresh-data')

      try {
        await new Promise(resolve => setImmediate(resolve))
        expect(serialize).not.toHaveBeenCalled()
      } finally {
        releaseRead?.()
        await Promise.allSettled([cleanupPromise, setPromise])
        readFileSpy.mockRestore()
      }

      expect(await setPromise).toBe('shared-key')
      expect((await cleanupPromise).errors).toEqual([])
      expect(await cache.getByKey('shared-key')).toBe('fresh-data')
    })
  })
})
