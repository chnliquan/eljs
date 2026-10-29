import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'

import type { CacheFile } from '../types'

/**
 * 当前磁盘缓存格式版本
 *
 * @internal
 */
export const CACHE_FILE_VERSION = '2.0' as const

/**
 * 原子写入临时文件超过该时间后可视为进程崩溃遗留
 *
 * @internal
 */
export const STALE_CACHE_TEMP_FILE_AGE_MS = 24 * 60 * 60 * 1000

const CACHE_TEMP_FILE_PATTERN =
  /^[a-f0-9]{64}\.json\.\d+\.[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.tmp$/u

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isSafePositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isCacheHash(value: unknown): value is string {
  return typeof value === 'string' && /^(?:|[a-f0-9]{64})$/u.test(value)
}

/**
 * 判断文件名是否属于原子写入产生的临时文件
 *
 * @param fileName - 缓存目录中的文件名
 * @returns 文件名符合当前临时文件协议时返回 `true`
 * @internal
 */
export function isCacheTemporaryFile(fileName: string): boolean {
  return CACHE_TEMP_FILE_PATTERN.test(fileName)
}

/**
 * 校验来自磁盘的不可信缓存文件结构
 *
 * @remarks
 * 该校验拒绝未知版本和不完整元数据，避免类型断言把任意 JSON 直接带入缓存生命周期
 *
 * @param value - JSON 解析后的未知值
 * @returns 结构和版本均受支持时返回 `true`
 * @internal
 */
export function isCacheFile(value: unknown): value is CacheFile<unknown> {
  if (
    !isRecord(value) ||
    value.version !== CACHE_FILE_VERSION ||
    !Object.hasOwn(value, 'data') ||
    !isRecord(value.metadata)
  ) {
    return false
  }

  const metadata = value.metadata

  return (
    isSafeNonNegativeInteger(metadata.timestamp) &&
    isFiniteNonNegativeNumber(metadata.mtime) &&
    isSafeNonNegativeInteger(metadata.size) &&
    isCacheHash(metadata.hash) &&
    isSafePositiveInteger(metadata.ttl) &&
    typeof metadata.key === 'string' &&
    metadata.key.length > 0 &&
    (metadata.dataUndefined === undefined ||
      typeof metadata.dataUndefined === 'boolean')
  )
}

/**
 * 从磁盘读取并校验缓存文件
 *
 * @remarks
 * 不跟随符号链接，打开后检查文件身份、普通文件类型和大小
 * 读取缓冲区最多为检查时的文件大小，额外探测一个字节以拒绝检查后增长的文件
 *
 * @param filePath - 缓存文件绝对路径
 * @param maxEntryBytes - 完整持久化文件的最大字节数
 * @returns 受支持的缓存文件，缺失、超限、非普通文件、损坏或版本不兼容时返回 `null`
 * @internal
 */
export async function readCacheFile(
  filePath: string,
  maxEntryBytes: number,
): Promise<CacheFile<unknown> | null> {
  let handle: fs.promises.FileHandle | undefined

  try {
    const beforeOpen = await fs.promises.lstat(filePath)

    if (!beforeOpen.isFile()) {
      return null
    }

    handle = await fs.promises.open(
      filePath,
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK,
    )
    const stat = await handle.stat()

    if (
      !stat.isFile() ||
      stat.dev !== beforeOpen.dev ||
      stat.ino !== beforeOpen.ino ||
      !Number.isSafeInteger(stat.size) ||
      stat.size < 0 ||
      stat.size > maxEntryBytes
    ) {
      return null
    }

    // 不使用 readFile，避免检查后膨胀的文件驱动无界缓冲区分配
    const buffer = Buffer.alloc(stat.size)
    let offset = 0

    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        offset,
        buffer.length - offset,
        offset,
      )

      if (bytesRead === 0) {
        return null
      }

      offset += bytesRead
    }

    const probe = await handle.read(Buffer.alloc(1), 0, 1, offset)
    const afterRead = await handle.stat()

    if (probe.bytesRead !== 0 || afterRead.size !== offset) {
      return null
    }

    const value: unknown = JSON.parse(buffer.toString('utf8'))

    return isCacheFile(value) ? value : null
  } catch {
    return null
  } finally {
    await handle?.close().catch(() => {})
  }
}

/**
 * 将缓存文件原子写入目标路径
 *
 * @remarks
 * 临时文件与目标文件位于同一目录，写入完成后通过重命名发布，避免读取方观察到半写入 JSON
 * 临时文件使用仅当前用户可读写的权限，失败时会尽力清理，进程崩溃遗留文件由缓存清理流程延迟回收
 *
 * @param filePath - 最终缓存文件绝对路径
 * @param content - 已完成序列化与容量准入校验的完整 UTF-8 JSON 文本
 * @returns 重命名发布完成后结束
 * @throws 写入或重命名失败时抛出原始错误
 * @internal
 */
export async function writeCacheFileAtomic(
  filePath: string,
  content: string,
): Promise<void> {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`

  try {
    await fs.promises.writeFile(temporaryPath, content, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    })
    await fs.promises.rename(temporaryPath, filePath)
  } catch (error) {
    await fs.promises.rm(temporaryPath, { force: true }).catch(() => {})
    throw error
  }
}
