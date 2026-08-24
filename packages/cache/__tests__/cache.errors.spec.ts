import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as fs from 'node:fs'
import * as path from 'node:path'

import { Cache, CacheKeyGenerator, CacheSerializer } from '../src'
import {
  cleanupDir,
  createBlockedDirectoryPath,
  createTempDir,
  createTempFile,
} from './test-utils'

describe('Cache 错误处理和边界情况测试', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempDir('cache-error-test-')
  })

  afterEach(() => {
    cleanupDir(tempDir)
  })

  describe('文件系统错误处理', () => {
    it('应该处理无法创建缓存目录的情况', async () => {
      const blockedCacheDir = createBlockedDirectoryPath(tempDir)
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: blockedCacheDir,
        autoCleanup: false,
      })

      // 应该不会崩溃，而是静默失败
      const result = await cache.get('/some/file.txt')
      expect(result).toBeNull()

      // 缓存应该被禁用
      expect(cache.options.enabled).toBe(true)
      expect(cache.enabled).toBe(false)
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

    it('应该处理磁盘写入失败的情况', async () => {
      const cache = new Cache<string>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'test.txt', 'content')
      await cache.getStats()

      // 用普通文件占据缓存目录路径，稳定触发后续原子写入失败
      fs.rmSync(cache.cacheDir, { recursive: true, force: true })
      fs.writeFileSync(cache.cacheDir, 'not a directory')
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await cache.set(testFile, 'data')

      expect(warning).toHaveBeenCalled()
      expect(cache.memoryCache.size).toBe(1)
      expect(await cache.get(testFile)).toBe('data')
    })
  })

  describe('序列化错误处理', () => {
    it('应该处理序列化失败', async () => {
      interface CircularObject {
        self: CircularObject | null
      }

      const faultySerializer: CacheSerializer<CircularObject> = {
        serialize: () => {
          throw new Error('Serialization failed')
        },
        deserialize: data => data as CircularObject,
      }

      const cache = new Cache<CircularObject>({
        enabled: true,
        cacheDir: path.join(tempDir, '.cache'),
        serializer: faultySerializer,
        autoCleanup: false,
      })

      const testFile = createTempFile(tempDir, 'test.txt', 'content')
      const circularObj: CircularObject = { self: null }
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
    it('读取异常日志不应该暴露原始逻辑键', async () => {
      const cache = new Cache<string>({
        cacheDir: path.join(tempDir, '.cache-redacted-key'),
        autoCleanup: false,
      })
      await cache.getStats()
      const cacheWithLoadFailure = cache as unknown as {
        _loadFromDisk: (key: string) => Promise<null>
      }
      vi.spyOn(cacheWithLoadFailure, '_loadFromDisk').mockRejectedValueOnce(
        new Error('read failed'),
      )
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const sensitiveKey = 'token=user-secret'

      expect(await cache.getByKey(sensitiveKey)).toBeNull()
      expect(warning).toHaveBeenCalledWith(
        'Failed to get cache by key:',
        expect.any(Error),
      )
      expect(warning.mock.calls.flat().join(' ')).not.toContain(sensitiveKey)
    })

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
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Key generation failed')
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

    it('应该将包含路径穿越字符的键安全地映射到缓存目录内', async () => {
      const cacheDir = path.join(tempDir, '.cache')
      const cache = new Cache<string>({
        enabled: true,
        cacheDir,
        keyGenerator: () => '../escaped',
        autoCleanup: false,
      })

      await cache.setByData('safe data')

      expect(await cache.getByKey('../escaped')).toBe('safe data')
      expect(fs.existsSync(path.join(tempDir, 'escaped.json'))).toBe(false)
      expect(fs.readdirSync(cacheDir)).toEqual([
        expect.stringMatching(/^[a-f0-9]{64}\.json$/u),
      ])
    })
  })

  describe('统计错误处理', () => {
    it('单文件统计失败时仍应按目录快照计算文件数', async () => {
      const cache = new Cache<string>({
        cacheDir: path.join(tempDir, '.cache-stat-failure'),
        autoCleanup: false,
        keyGenerator: data => data,
      })
      await cache.setByData('first')
      await cache.setByData('second')
      const statSpy = vi
        .spyOn(fs.promises, 'stat')
        .mockRejectedValueOnce(new Error('stat failed'))

      const stats = await cache.getStats()

      expect(stats.files).toBe(2)
      statSpy.mockRestore()
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
      const cache = new Cache<null | undefined>({
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
      interface LargeObject {
        data: string
        array: string[]
        nested: {
          level1: { level2: { level3: string } }
        }
      }

      const cache = new Cache<LargeObject>({
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

      // 内存和磁盘都应持续满足配置上限
      expect(cache.memoryCache.size).toBeLessThanOrEqual(100)
      expect(
        fs
          .readdirSync(cache.cacheDir)
          .filter(file => /^[a-f0-9]{64}\.json$/u.test(file)),
      ).toHaveLength(100)
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
      expect(cache.memoryCache.size).toBe(0)
      expect(
        fs
          .readdirSync(cache.cacheDir)
          .filter(file => /^[a-f0-9]{64}\.json$/u.test(file)),
      ).toHaveLength(0)
    })
  })

  describe('配置验证', () => {
    it('应该拒绝不能安全持久化的数据时间戳', async () => {
      const cache = new Cache<string>({
        cacheDir: path.join(tempDir, '.cache-invalid-timestamp'),
        autoCleanup: false,
      })

      for (const timestamp of [
        -1,
        1.5,
        Number.MAX_SAFE_INTEGER + 1,
        Number.POSITIVE_INFINITY,
      ]) {
        await expect(cache.setByData('data', { timestamp })).rejects.toThrow(
          'metadata.timestamp must be a non-negative safe integer',
        )
      }
    })

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

    it('应该拒绝无效的TTL和文件数量限制', () => {
      expect(() => new Cache({ ttlDays: 0 })).toThrow(RangeError)
      expect(() => new Cache({ ttlDays: Number.NaN })).toThrow(RangeError)
      expect(() => new Cache({ ttlDays: Number.MAX_VALUE })).toThrow(RangeError)
      expect(() => new Cache({ maxFiles: 0 })).toThrow(RangeError)
      expect(() => new Cache({ maxFiles: 1.5 })).toThrow(RangeError)
      expect(() => new Cache({ cacheDir: '' })).toThrow(TypeError)
    })
  })
})
