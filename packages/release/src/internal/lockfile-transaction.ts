import { randomUUID } from 'node:crypto'
import { chmod, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const LOCKFILE_NAMES = [
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
] as const

/**
 * 单个内置文件在写入前的磁盘状态，供清单、变更日志和锁文件恢复复用
 *
 * @internal
 */
export interface LockfileSnapshotEntry {
  /** 已通过调用方边界校验的文件绝对路径 */
  readonly path: string
  /** 原始二进制内容，不存在时为 `null` */
  readonly content: Buffer | null
  /** 原文件权限位 */
  readonly mode?: number
}

/**
 * 内置文件写入前的完整快照，锁文件更新时覆盖所有受支持格式
 *
 * @internal
 */
export type LockfileSnapshot = readonly LockfileSnapshotEntry[]

/**
 * 读取工作目录中所有受支持锁文件的原始状态
 *
 * @remarks
 * 同时记录其他包管理器的锁文件，可撤销 Bun 自动迁移等跨格式副作用
 *
 * @param cwd - 发布工作目录
 * @returns 包含存在状态、二进制内容和权限的锁文件快照
 * @throws 当文件读取或元数据查询失败时传播原始错误
 * @internal
 */
export async function captureLockfiles(cwd: string): Promise<LockfileSnapshot> {
  return captureFileSnapshots(LOCKFILE_NAMES.map(name => path.join(cwd, name)))
}

/**
 * 保存内置流程将改写的文件的字节、权限及存在状态
 *
 * @param paths - 已通过各自路径边界校验的绝对路径
 * @throws 文件读取或元数据查询失败时传播原始错误
 * @internal
 */
export async function captureFileSnapshots(
  paths: readonly string[],
): Promise<LockfileSnapshot> {
  const snapshot: LockfileSnapshotEntry[] = []

  for (const filePath of paths) {
    try {
      const [content, metadata] = await Promise.all([
        readFile(filePath),
        stat(filePath),
      ])
      snapshot.push({
        content,
        mode: metadata.mode & 0o777,
        path: filePath,
      })
    } catch (error) {
      if (isNotFoundError(error)) {
        snapshot.push({ content: null, path: filePath })
        continue
      }

      throw error
    }
  }

  return snapshot
}

/**
 * 按逆序恢复内置文件快照并删除写入期间新建的文件
 *
 * @param snapshot - 内置文件写入前捕获的快照
 * @returns 全部文件恢复完成后兑现的 Promise
 * @throws 当一个或多个文件无法恢复时抛出原始错误或聚合错误
 * @internal
 */
export async function restoreLockfiles(
  snapshot: LockfileSnapshot,
): Promise<void> {
  const restoreErrors: unknown[] = []

  for (const entry of [...snapshot].reverse()) {
    try {
      if (entry.content === null) {
        await rm(entry.path, { force: true })
      } else {
        await atomicWriteBuffer(entry.path, entry.content, entry.mode)
      }
    } catch (error) {
      restoreErrors.push(error)
    }
  }

  if (restoreErrors.length === 1) {
    throw restoreErrors[0]
  }

  if (restoreErrors.length > 1) {
    throw new AggregateError(
      restoreErrors,
      'One or more built-in files could not be restored.',
    )
  }
}

async function atomicWriteBuffer(
  filePath: string,
  content: Buffer,
  mode?: number,
): Promise<void> {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`

  try {
    await writeFile(temporaryPath, content, { flag: 'wx', mode })

    if (mode !== undefined) {
      await chmod(temporaryPath, mode)
    }

    await rename(temporaryPath, filePath)
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}
