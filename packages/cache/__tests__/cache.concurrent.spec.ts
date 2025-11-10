/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { Cache } from '../src'

// 测试工具函数
const createTempDir = () => {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cache-concurrent-test-'))
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

describe('Cache 并发初始化测试', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempDir()
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
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: '/invalid/path/that/cannot/be/created',
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

      // 但初始化Promise应该已经存在
      expect((cache as any)._initializationPromise).toBeDefined()
    })

    it('应该在禁用缓存时跳过初始化', async () => {
      const cache = new Cache<string>({
        enabled: false,
        cacheDir: path.join(tempDir, '.cache'),
      })

      await cache.get('/some/file.txt')

      // 应该保持未初始化状态
      expect(cache.initialized).toBe(false)
      expect((cache as any)._initializationPromise).toBeNull()
    })

    it('应该在多次调用_ensureInitialized时返回相同的Promise', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      // 获取_ensureInitialized方法的引用
      const ensureInit = (cache as any)._ensureInitialized.bind(cache)

      // 多次调用应该返回相同的Promise
      const promise1 = ensureInit()
      const promise2 = ensureInit()
      const promise3 = ensureInit()

      const results = await Promise.all([promise1, promise2, promise3])

      // 所有调用都应该成功完成
      expect(results).toHaveLength(3)
      expect(cache.initialized).toBe(true)
    })
  })

  describe('错误恢复', () => {
    it('应该在初始化错误后清理Promise状态', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: '/invalid/path/that/cannot/be/created',
        autoCleanup: false,
      })

      // 第一次调用会失败并禁用缓存
      await cache.get('/some/file.txt')

      // 验证状态清理
      expect((cache as any)._initializationPromise).toBeNull()
      expect(cache.options.enabled).toBe(false)
    })

    it('应该在初始化失败后所有后续调用都返回null', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: '/invalid/path',
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
    it('应该在初始化完成后清理Promise引用', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      // 确保初始化完成
      await cache.getStats()

      // Promise引用应该被清理
      expect((cache as any)._initializationPromise).toBeNull()
      expect(cache.initialized).toBe(true)
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
  })
})
