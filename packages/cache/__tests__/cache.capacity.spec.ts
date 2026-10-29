import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Cache, type CacheFile } from '../src'
import * as cacheFile from '../src/internal/cache-file'
import {
  cleanupDir,
  createTempDir,
  createTempFile,
  waitForCondition,
} from './test-utils'

function envelope(key: string, data: string, timestamp = Date.now()): string {
  const value: CacheFile<string> = {
    version: '2.0',
    data,
    metadata: {
      timestamp,
      mtime: timestamp,
      size: 0,
      hash: '',
      ttl: 86400000,
      key,
    },
  }
  return `${JSON.stringify(value)}\n`
}

function cachePath(directory: string, key: string): string {
  return path.join(
    directory,
    `${crypto.createHash('sha256').update(key).digest('hex')}.json`,
  )
}

describe('Cache 容量准入与有界持久化', () => {
  let directory: string

  beforeEach(() => {
    directory = createTempDir('cache-capacity-')
  })

  afterEach(() => {
    cleanupDir(directory)
  })

  it('校验容量必须为正安全整数且单条上限不超过总上限', () => {
    for (const value of [
      0,
      -1,
      0.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(() => new Cache({ enabled: false, maxEntryBytes: value })).toThrow(
        RangeError,
      )
      expect(() => new Cache({ enabled: false, maxDiskBytes: value })).toThrow(
        RangeError,
      )
    }
    expect(
      () =>
        new Cache({
          enabled: false,
          maxEntryBytes: 2,
          maxDiskBytes: 1,
        }),
    ).toThrow('maxEntryBytes must not exceed maxDiskBytes')
    const cache = new Cache({ enabled: false })
    expect(cache.options.maxEntryBytes).toBe(16 * 1024 * 1024)
    expect(cache.options.maxDiskBytes).toBe(256 * 1024 * 1024)
  })

  it('按含元数据及换行的 UTF-8 字节准入且只调用一次 serializer 和 toJSON', async () => {
    const toJSON = vi.fn(() => '中文🙂'.repeat(40))
    const serialize = vi.fn(() => ({ toJSON }))
    const writer = new Cache<string>({
      cacheDir: directory,
      autoCleanup: false,
      keyGenerator: () => 'key',
      serializer: { serialize, deserialize: value => value as string },
    })
    await writer.setByData('input')
    expect(serialize).toHaveBeenCalledTimes(1)
    expect(toJSON).toHaveBeenCalledTimes(1)
    const filePath = cachePath(directory, 'key')
    const content = fs.readFileSync(filePath, 'utf8')
    const bytes = Buffer.byteLength(content)
    expect(bytes).toBeGreaterThan(content.length)
    vi.spyOn(Date, 'now').mockReturnValue(
      (JSON.parse(content) as CacheFile<string>).metadata.timestamp,
    )

    const accepted = new Cache<string>({
      cacheDir: directory,
      autoCleanup: false,
      maxEntryBytes: bytes,
      maxDiskBytes: bytes,
      keyGenerator: () => 'key',
      serializer: { serialize, deserialize: value => value as string },
    })
    expect(await accepted.getByKey('key')).toBe('中文🙂'.repeat(40))
    expect(await accepted.setByData('input')).toBe('key')
    expect(serialize).toHaveBeenCalledTimes(2)
    expect(toJSON).toHaveBeenCalledTimes(2)

    const rejected = new Cache<string>({
      cacheDir: directory,
      autoCleanup: false,
      keyGenerator: () => 'key',
      maxEntryBytes: bytes - 1,
      serializer: { serialize, deserialize: value => value as string },
    })
    expect(await rejected.setByData('input')).toBeNull()
    expect(serialize).toHaveBeenCalledTimes(3)
    expect(toJSON).toHaveBeenCalledTimes(3)
    expect(rejected.memoryCache.size).toBe(0)
    expect(fs.existsSync(filePath)).toBe(false)
    expect(rejected.stats.diskUsage).toBe(0)
  })

  it('同键串行的超限写入移除旧值，后续合规写入仍可命中', async () => {
    const cache = new Cache<string>({
      cacheDir: directory,
      autoCleanup: false,
      keyGenerator: () => 'shared',
      maxEntryBytes: 256,
    })
    const results = await Promise.all([
      cache.setByData('old'),
      cache.setByData('中'.repeat(300)),
      cache.getByKey('shared'),
      cache.setByData('new'),
    ])
    expect(results).toEqual(['shared', null, null, 'shared'])
    expect(await cache.getByKey('shared')).toBe('new')
    expect(cache.stats.files).toBe(1)
    expect(cache.stats.diskUsage).toBe(
      fs.statSync(cachePath(directory, 'shared')).size,
    )
  })

  it('磁盘写失败时合规数据留在内存，超限文件缓存不得滞留', async () => {
    const cache = new Cache<string>({
      cacheDir: path.join(directory, 'cache'),
      autoCleanup: false,
      maxEntryBytes: 512,
    })
    const source = createTempFile(directory, 'source.txt', 'source')
    await cache.getStats()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(cacheFile, 'writeCacheFileAtomic').mockRejectedValue(
      new Error('disk failure'),
    )
    await cache.set(source, 'small')
    expect(await cache.get(source)).toBe('small')
    await cache.set(source, '中'.repeat(512))
    expect(cache.memoryCache.size).toBe(0)
    expect(await cache.get(source)).toBeNull()
  })

  it('无法序列化的条目不准入且不会保留同键旧值', async () => {
    const serialize = vi.fn((value: string) => {
      if (value === 'bad') {
        throw new Error('cannot determine size')
      }
      return value
    })
    const cache = new Cache<string>({
      cacheDir: directory,
      autoCleanup: false,
      keyGenerator: () => 'key',
      serializer: { serialize, deserialize: value => value as string },
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await cache.setByData('old')
    expect(await cache.setByData('bad')).toBeNull()
    expect(await cache.getByKey('key')).toBeNull()
    expect(cache.stats).toMatchObject({ files: 0, diskUsage: 0 })
  })

  it('超限磁盘文件在 fstat 后、分配和读取之前拒绝并关闭句柄', async () => {
    const filePath = cachePath(directory, 'large')
    fs.writeFileSync(filePath, envelope('large', 'x'.repeat(4096)))
    const open = fs.promises.open
    let read: ReturnType<typeof vi.spyOn> | undefined
    let close: ReturnType<typeof vi.spyOn> | undefined
    vi.spyOn(fs.promises, 'open').mockImplementationOnce(async (...args) => {
      const handle = await open(...args)
      read = vi.spyOn(handle, 'read')
      close = vi.spyOn(handle, 'close')
      return handle
    })
    expect(await cacheFile.readCacheFile(filePath, 1024)).toBeNull()
    expect(read).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledTimes(1)

    const cache = new Cache({
      cacheDir: directory,
      autoCleanup: false,
      maxEntryBytes: 1024,
    })
    expect(await cache.getByKey('large')).toBeNull()
    expect(cache.memoryCache.size).toBe(0)
    expect(fs.existsSync(filePath)).toBe(false)
    expect(cache.stats.diskUsage).toBe(0)
  })

  it('拒绝 stat 后膨胀且实际读取缓冲区不随新文件大小增长', async () => {
    const content = envelope('grow', 'small')
    const filePath = createTempFile(directory, 'grow.json', content)
    const originalSize = Buffer.byteLength(content)
    const open = fs.promises.open
    const buffers: Buffer[] = []
    vi.spyOn(fs.promises, 'open').mockImplementationOnce(async (...args) => {
      const handle = await open(...args)
      const stat = handle.stat.bind(handle)
      vi.spyOn(handle, 'stat').mockImplementationOnce(async () => {
        const snapshot = await stat()
        fs.appendFileSync(filePath, 'x'.repeat(8192))
        return snapshot
      })
      const read = handle.read.bind(handle)
      // 代理保留真实的短读行为，并观测分配给每次读取的缓冲区
      const readSpy = vi.spyOn(handle, 'read')
      readSpy.mockImplementation(async (...args) => {
        if (Buffer.isBuffer(args[0])) {
          buffers.push(args[0])
        }
        return read(...args)
      })
      return handle
    })
    expect(await cacheFile.readCacheFile(filePath, 1024)).toBeNull()
    expect(buffers.map(buffer => buffer.length)).toEqual([originalSize, 1])
  })

  it('拒绝读取期间缩短的文件', async () => {
    const filePath = createTempFile(
      directory,
      'shrink.json',
      envelope('k', 'v'),
    )
    const open = fs.promises.open
    vi.spyOn(fs.promises, 'open').mockImplementationOnce(async (...args) => {
      const handle = await open(...args)
      const stat = handle.stat.bind(handle)
      vi.spyOn(handle, 'stat').mockImplementationOnce(async () => {
        const snapshot = await stat()
        fs.truncateSync(filePath, 0)
        return snapshot
      })
      return handle
    })
    expect(await cacheFile.readCacheFile(filePath, 1024)).toBeNull()
  })

  it('普通文件短读时继续有界读取直到完成 JSON', async () => {
    const content = envelope('partial', '中文🙂')
    const filePath = createTempFile(directory, 'partial.json', content)
    const open = fs.promises.open
    let reads = 0
    vi.spyOn(fs.promises, 'open').mockImplementationOnce(async (...args) => {
      const handle = await open(...args)
      const read = handle.read.bind(handle)
      const shortRead = async (
        buffer: Buffer,
        offset: number,
        length: number,
        position: number,
      ) => {
        reads++
        return read({ buffer, offset, length: Math.min(length, 7), position })
      }
      vi.spyOn(handle, 'read').mockImplementation(
        shortRead as typeof handle.read,
      )
      return handle
    })
    expect(await cacheFile.readCacheFile(filePath, 1024)).toEqual(
      JSON.parse(content),
    )
    expect(reads).toBeGreaterThan(2)
  })

  it('拒绝符号链接和目录，不读取或删除链接目标', async () => {
    const original = envelope('link', 'v')
    const target = createTempFile(directory, 'target.txt', original)
    const filePath = cachePath(directory, 'link')
    fs.symlinkSync(target, filePath)
    const cache = new Cache({
      cacheDir: directory,
      autoCleanup: false,
    })
    const readFile = vi.spyOn(fs.promises, 'readFile')
    expect(await cache.getByKey('link')).toBeNull()
    expect(readFile).not.toHaveBeenCalled()
    expect(fs.readFileSync(target, 'utf8')).toBe(original)
    expect(fs.existsSync(filePath)).toBe(false)
    expect(await cacheFile.readCacheFile(directory, 1024)).toBeNull()
  })

  it('拒绝 lstat 与 open 之间替换的符号链接', async () => {
    const target = createTempFile(directory, 'target.txt', envelope('k', 'v'))
    const filePath = createTempFile(
      directory,
      'race.json',
      envelope('k', 'old'),
    )
    const open = fs.promises.open
    vi.spyOn(fs.promises, 'open').mockImplementationOnce(async (...args) => {
      fs.unlinkSync(filePath)
      fs.symlinkSync(target, filePath)
      return open(...args)
    })
    expect(await cacheFile.readCacheFile(filePath, 1024)).toBeNull()
    expect(fs.existsSync(target)).toBe(true)
  })

  it('拒绝 lstat 与 open 之间替换的普通文件身份', async () => {
    const filePath = createTempFile(
      directory,
      'identity.json',
      envelope('k', 'old'),
    )
    const open = fs.promises.open
    vi.spyOn(fs.promises, 'open').mockImplementationOnce(async (...args) => {
      fs.renameSync(filePath, `${filePath}.old`)
      fs.writeFileSync(filePath, envelope('k', 'new'))
      return open(...args)
    })
    expect(await cacheFile.readCacheFile(filePath, 1024)).toBeNull()
  })

  it('已有目录首次写入按总字节限额最旧优先淘汰，覆盖和 clear 统计一致', async () => {
    const now = Date.now()
    for (let index = 0; index < 3; index++) {
      fs.writeFileSync(
        cachePath(directory, `k${index}`),
        envelope(`k${index}`, 'x'.repeat(200), now - 1000 + index),
      )
    }
    const cache = new Cache<string>({
      cacheDir: directory,
      autoCleanup: false,
      keyGenerator: value => value.slice(0, 2),
      maxFiles: 10,
      maxEntryBytes: 512,
      maxDiskBytes: 850,
    })
    await cache.setByData('k3' + 'x'.repeat(200))
    expect(fs.existsSync(cachePath(directory, 'k0'))).toBe(false)
    expect(fs.existsSync(cachePath(directory, 'k1'))).toBe(false)
    expect(fs.existsSync(cachePath(directory, 'k2'))).toBe(true)
    expect(cache.stats.files).toBe(2)
    expect(cache.stats.diskUsage).toBeLessThanOrEqual(850)
    await cache.setByData('k3small')
    const size = fs
      .readdirSync(directory)
      .reduce(
        (total, file) => total + fs.lstatSync(path.join(directory, file)).size,
        0,
      )
    expect(cache.stats).toMatchObject({ files: 2, diskUsage: size })
    expect(await cache.getStats()).toMatchObject({ files: 2, diskUsage: size })
    await cache.clear()
    expect(cache.stats).toMatchObject({ files: 0, diskUsage: 0 })
  })

  it('并发不同键发布与共享清理后同时满足文件数和磁盘字节限制', async () => {
    const cache = new Cache<string>({
      cacheDir: directory,
      autoCleanup: false,
      keyGenerator: value => value.slice(0, 3),
      maxFiles: 3,
      maxEntryBytes: 512,
      maxDiskBytes: 850,
    })
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        cache.setByData(`k${String(index).padStart(2, '0')}` + 'x'.repeat(200)),
      ),
    )
    const stats = await cache.getStats()
    expect(stats.files).toBe(2)
    expect(stats.diskUsage).toBeLessThanOrEqual(850)
    expect(cache.memoryCache.size).toBeLessThanOrEqual(2)
    expect(cache.stats.diskUsage).toBe(
      fs
        .readdirSync(directory)
        .reduce(
          (total, file) => total + fs.statSync(path.join(directory, file)).size,
          0,
        ),
    )
  })

  it('cleanup 串行解析 JSON，不调用 serializer 或 deserialize，回收超限与过期文件', async () => {
    const now = Date.now()
    fs.writeFileSync(
      cachePath(directory, 'expired'),
      envelope('expired', '', 0),
    )
    fs.writeFileSync(
      cachePath(directory, 'oversize'),
      envelope('oversize', 'x'.repeat(2000)),
    )
    for (let index = 0; index < 6; index++) {
      fs.writeFileSync(
        cachePath(directory, `k${index}`),
        envelope(`k${index}`, 'v', now),
      )
    }
    const serialize = vi.fn((data: string) => data)
    const deserialize = vi.fn((data: unknown) => data as string)
    const cache = new Cache<string>({
      cacheDir: directory,
      autoCleanup: false,
      maxEntryBytes: 512,
      maxDiskBytes: 1024,
      serializer: { serialize, deserialize },
    })
    await cache.getStats()
    const read = cacheFile.readCacheFile
    let active = 0
    let peak = 0
    vi.spyOn(cacheFile, 'readCacheFile').mockImplementation(async (...args) => {
      active++
      peak = Math.max(peak, active)
      try {
        await new Promise(resolve => setImmediate(resolve))
        return await read(...args)
      } finally {
        active--
      }
    })
    const cleanup = cache.cleanup()
    expect(cache.cleanup()).toBe(cleanup)
    const result = await cleanup
    expect(peak).toBe(1)
    expect(serialize).not.toHaveBeenCalled()
    expect(deserialize).not.toHaveBeenCalled()
    expect(result.errors).toEqual([])
    expect(result.removed).toBeGreaterThanOrEqual(2)
    expect(result.totalSize).toBeGreaterThan(2000)
    expect(cache.stats.diskUsage).toBeLessThanOrEqual(1024)
    expect(fs.existsSync(cachePath(directory, 'expired'))).toBe(false)
    expect(fs.existsSync(cachePath(directory, 'oversize'))).toBe(false)
  })

  it('旧文件迁移不调用 serializer 且增量统计只保留新文件大小', async () => {
    const key = 'a'.repeat(32)
    const original = envelope(key, 'value')
    const oldPath = createTempFile(directory, `${key}.json`, original)
    const serialize = vi.fn(() => {
      throw new Error('must not serialize a migration')
    })
    const cache = new Cache<string>({
      cacheDir: directory,
      autoCleanup: false,
      maxEntryBytes: Buffer.byteLength(original),
      maxDiskBytes: Buffer.byteLength(original),
      serializer: { serialize, deserialize: data => data as string },
    })
    expect(await cache.getByKey(key)).toBe('value')
    expect(serialize).not.toHaveBeenCalled()
    expect(fs.existsSync(oldPath)).toBe(false)
    expect(cache.stats).toMatchObject({
      files: 1,
      diskUsage: Buffer.byteLength(original),
    })
  })

  it.each(['capacity', 'disk'])(
    '旧文件迁移因 %s 失败仍可命中，保留原文件与正确容量',
    async failure => {
      const key = 'b'.repeat(32)
      const original = envelope(key, 'value').trimEnd()
      const oldPath = createTempFile(directory, `${key}.json`, original)
      const serialize = vi.fn((data: string) => data)
      const cache = new Cache<string>({
        cacheDir: directory,
        autoCleanup: false,
        maxEntryBytes:
          failure === 'capacity' ? Buffer.byteLength(original) : 512,
        serializer: { serialize, deserialize: data => data as string },
      })
      const publish = vi.spyOn(cacheFile, 'writeCacheFileAtomic')
      if (failure === 'disk') {
        publish.mockRejectedValueOnce(new Error('migration write failed'))
        vi.spyOn(console, 'warn').mockImplementation(() => {})
      }
      expect(await cache.getByKey(key)).toBe('value')
      expect(serialize).not.toHaveBeenCalled()
      expect(fs.existsSync(oldPath)).toBe(true)
      expect(fs.existsSync(cachePath(directory, key))).toBe(false)
      expect(cache.stats).toMatchObject({
        files: 1,
        diskUsage: Buffer.byteLength(original),
      })
      expect(publish).toHaveBeenCalledTimes(failure === 'capacity' ? 0 : 1)
    },
  )

  it('统计扫描与覆盖并发时不会覆盖新发布的字节统计', async () => {
    const cache = new Cache<string>({
      cacheDir: directory,
      autoCleanup: false,
      keyGenerator: () => 'key',
    })
    await cache.setByData('old')
    const lstat = fs.promises.lstat
    let release: (() => void) | undefined
    let started: (() => void) | undefined
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    const scanStarted = new Promise<void>(resolve => {
      started = resolve
    })
    vi.spyOn(fs.promises, 'lstat').mockImplementationOnce(async (...args) => {
      const snapshot = await lstat(...args)
      started?.()
      await gate
      return snapshot
    })
    const scan = cache.getStats()
    await scanStarted
    try {
      await cache.setByData('new'.repeat(100))
    } finally {
      release?.()
    }
    const stats = await scan
    expect(stats.files).toBe(1)
    expect(stats.diskUsage).toBe(fs.statSync(cachePath(directory, 'key')).size)
    expect(await cache.getByKey('key')).toBe('new'.repeat(100))
  })

  it('clear 删除失败时统计残余容量，后续写入重试容量收敛', async () => {
    const cache = new Cache<string>({
      cacheDir: directory,
      autoCleanup: false,
      keyGenerator: value => value,
      maxEntryBytes: 512,
      maxDiskBytes: 512,
    })
    await cache.setByData('old')
    const size = cache.stats.diskUsage
    const unlink = vi
      .spyOn(fs.promises, 'unlink')
      .mockRejectedValueOnce(new Error('delete failed'))
    await cache.clear()
    expect(cache.stats).toMatchObject({ files: 1, diskUsage: size })
    unlink.mockRestore()
    await cache.setByData('new')
    expect(cache.stats.diskUsage).toBeLessThanOrEqual(512)
  })

  it('clear 取消等待中的超限写入，结束后内存与磁盘统计为空', async () => {
    const cache = new Cache<string>({
      cacheDir: directory,
      autoCleanup: false,
      maxEntryBytes: 256,
    })
    await cache.getStats()
    const write = cache.setByData('x'.repeat(1024))
    const clear = cache.clear()
    await Promise.all([write, clear])
    await waitForCondition(() => cache.memoryCache.size === 0)
    expect(cache.stats).toMatchObject({ files: 0, diskUsage: 0 })
  })

  it('缓存目录已不存在时 clear 将磁盘统计归零', async () => {
    const cache = new Cache<string>({
      cacheDir: path.join(directory, 'cache'),
      autoCleanup: false,
    })
    await cache.setByData('old')
    fs.rmSync(cache.cacheDir, { recursive: true })
    await cache.clear()
    expect(cache.stats).toMatchObject({ files: 0, diskUsage: 0 })
  })
})
