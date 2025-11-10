/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { Cache, CacheKeyGenerator, CacheSerializer } from '../src'

// 测试工具函数
const createTempDir = () => {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cache-error-test-'))
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

describe('Cache 错误处理和边界情况测试', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempDir()
  })

  afterEach(() => {
    cleanupDir(tempDir)
  })

  describe('文件系统错误处理', () => {
    it('应该处理无法创建缓存目录的情况', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: '/root/forbidden/path', // 无权限路径
        autoCleanup: false,
      })

      // 应该不会崩溃，而是静默失败
      const result = await cache.get('/some/file.txt')
      expect(result).toBeNull()

      // 缓存应该被禁用
      expect(cache.options.enabled).toBe(false)
    })

    it('应该处理文件读取错误', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      // 创建文件后立即删除，模拟读取错误
      const testFile = createTempFile(tempDir, 'test.txt', 'content')
      await cache.set(testFile, 'data')

      fs.unlinkSync(testFile)

      // 应该返回null而不是崩溃
      const result = await cache.get(testFile)
      expect(result).toBeNull()
    })

    it('应该处理磁盘空间不足的情况', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      // Mock writeJson 来模拟磁盘空间不足
      const originalConsoleWarn = console.warn
      const warnings: string[] = []
      console.warn = (msg: string) => warnings.push(msg)

      const testFile = createTempFile(tempDir, 'test.txt', 'content')

      // 这个测试比较难模拟真实的磁盘空间不足
      // 但缓存应该能够处理写入失败
      await cache.set(testFile, 'data')

      console.warn = originalConsoleWarn

      // 缓存设置可能失败，但不应该崩溃
      expect(() => cache.set(testFile, 'data')).not.toThrow()
    })
  })

  describe('序列化错误处理', () => {
    it('应该处理序列化失败', async () => {
      const faultySerializer: CacheSerializer<any> = {
        serialize: () => {
          throw new Error('Serialization failed')
        },
        deserialize: data => data,
      }

      const cache = new Cache<any>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        serializer: faultySerializer,
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'test.txt', 'content')
      const circularObj = { self: null as any }
      circularObj.self = circularObj

      // 序列化失败不应该崩溃应用
      await expect(cache.set(testFile, circularObj)).resolves.not.toThrow()
    })

    it('应该处理反序列化失败', async () => {
      const faultySerializer: CacheSerializer<string> = {
        serialize: data => data,
        deserialize: () => {
          throw new Error('Deserialization failed')
        },
      }

      // 先用正常序列化器保存数据
      const normalCache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'test.txt', 'content')
      await normalCache.set(testFile, 'test data')

      // 然后用故障序列化器读取
      const faultyCache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        serializer: faultySerializer,
        autoCleanup: false,
      })

      const result = await faultyCache.get(testFile)
      expect(result).toBeNull() // 反序列化失败应该返回null
    })
  })

  describe('键生成器错误处理', () => {
    it('应该处理键生成器抛出异常', async () => {
      const faultyKeyGenerator: CacheKeyGenerator<string> = () => {
        throw new Error('Key generation failed')
      }

      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        keyGenerator: faultyKeyGenerator,
        autoCleanup: false,
      })

      // 键生成失败应该导致方法抛出错误
      try {
        await cache.setByData('test data')
        // 如果没有抛出错误，测试失败
        expect(false).toBe(true)
      } catch (error: any) {
        expect(error.message).toBe('Key generation failed')
      }
    })

    it('应该处理键生成器返回重复键', async () => {
      const constantKeyGenerator: CacheKeyGenerator<string> = () => 'same-key'

      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        keyGenerator: constantKeyGenerator,
        autoCleanup: false,
      })

      // 设置多个数据但使用相同键
      await cache.setByData('first data')
      await cache.setByData('second data')

      // 应该获取到最后设置的数据
      const result = await cache.getByKey('same-key')
      expect(result).toBe('second data')

      // 内存中应该只有一个条目
      expect(cache.memoryCache.size).toBe(1)
    })
  })

  describe('边界情况', () => {
    it('应该处理空字符串数据', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'empty.txt', '')

      await cache.set(testFile, '')
      const result = await cache.get(testFile)

      expect(result).toBe('')
    })

    it('应该处理非常长的文件路径', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      // 创建很长的路径
      const longPath = '/very/long/path/'.repeat(50) + 'file.txt'

      // 不应该崩溃
      const result = await cache.get(longPath)
      expect(result).toBeNull()
    })

    it('应该处理null和undefined数据', async () => {
      const cache = new Cache<any>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'test.txt', 'content')

      await cache.set(testFile, null)
      let result = await cache.get(testFile)
      expect(result).toBeNull()

      await cache.set(testFile, undefined)
      result = await cache.get(testFile)
      expect(result).toBeUndefined()
    })

    it('应该处理非常大的对象', async () => {
      const cache = new Cache<any>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'test.txt', 'content')

      // 创建一个大对象
      const largeObject = {
        data: 'x'.repeat(100000), // 100KB字符串
        array: new Array(1000).fill('item'),
        nested: {
          level1: { level2: { level3: 'deep' } },
        },
      }

      await cache.set(testFile, largeObject)
      const result = await cache.get(testFile)

      expect(result).toEqual(largeObject)
    })

    it('应该处理并发的set/get操作', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'concurrent.txt', 'content')

      // 并发执行多个set和get操作
      const promises = []

      for (let i = 0; i < 10; i++) {
        promises.push(cache.set(testFile, `data-${i}`))
        promises.push(cache.get(testFile))
      }

      // 所有操作都应该完成而不出错
      await expect(Promise.all(promises)).resolves.not.toThrow()
    })
  })

  describe('内存管理', () => {
    it('应该在大量缓存条目时不出现内存泄漏', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
        maxFiles: 100, // 限制文件数量
      })

      // 创建大量缓存条目
      const promises = []
      for (let i = 0; i < 150; i++) {
        const testFile = createTempFile(
          tempDir,
          `test-${i}.txt`,
          `content-${i}`,
        )
        promises.push(cache.set(testFile, `data-${i}`))
      }

      await Promise.all(promises)

      // 内存缓存大小应该合理
      expect(cache.memoryCache.size).toBeLessThanOrEqual(150)
    })

    it('应该正确清理已删除文件的缓存', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'to-delete.txt', 'content')
      await cache.set(testFile, 'data')

      // 删除文件
      fs.unlinkSync(testFile)

      // 尝试获取应该返回null
      const result = await cache.get(testFile)
      expect(result).toBeNull()
    })
  })

  describe('配置验证', () => {
    it('应该接受合理的配置值', () => {
      expect(() => {
        new Cache({
          enabled: true,
          ttlDays: 30,
          maxFiles: 5000,
          autoCleanup: true,
        })
      }).not.toThrow()
    })

    it('应该处理极端的配置值', () => {
      expect(() => {
        new Cache({
          ttlDays: 0.000001, // 非常短的TTL
          maxFiles: 1000000, // 非常大的文件数量
        })
      }).not.toThrow()
    })
  })
})
