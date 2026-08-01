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
 * 单个受支持锁文件在命令执行前的磁盘状态
 *
 * @internal
 */
export interface LockfileSnapshotEntry {
  /** 锁文件绝对路径 */
  readonly path: string
  /** 原始二进制内容，不存在时为 `null` */
  readonly content: Buffer | null
  /** 原文件权限位 */
  readonly mode?: number
}

/**
 * 锁文件更新命令执行前的完整快照
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
  const snapshot: LockfileSnapshotEntry[] = []

  for (const name of LOCKFILE_NAMES) {
    const filePath = path.join(cwd, name)

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
 * 恢复锁文件快照并删除命令执行期间新建的锁文件
 *
 * @param snapshot - 锁文件更新前捕获的快照
 * @returns 全部锁文件恢复完成后兑现的 Promise
 * @throws 当一个或多个锁文件无法恢复时抛出原始错误或聚合错误
 * @internal
 */
export async function restoreLockfiles(
  snapshot: LockfileSnapshot,
): Promise<void> {
  const restoreErrors: unknown[] = []

  for (const entry of snapshot) {
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
      'One or more lockfiles could not be restored.',
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
