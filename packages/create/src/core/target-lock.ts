import { isPathExists, move, remove } from '@eljs/utils/file'
import { createHash, randomUUID } from 'node:crypto'
import { open, readFile, writeFile, type FileHandle } from 'node:fs/promises'
import { hostname } from 'node:os'
import path from 'node:path'

import { AppError } from '../errors'

/**
 * 持久化到目标锁文件的恢复信息
 *
 * @remarks
 * `backupPath` 只允许指向工作目录直属的 `.eljs-backup-*` 路径，避免篡改锁文件后移动任意目录
 *
 * @internal
 */
interface TargetLockMetadata {
  readonly version: 1
  readonly ownerId: string
  readonly pid: number
  readonly hostname: string
  readonly targetDir: string
  readonly targetExisted: boolean
  readonly createdAt: string
  backupPath?: string
}

/**
 * 当前创建流程持有的目标锁
 *
 * @internal
 */
export interface TargetLock {
  readonly path: string
  readonly cwd: string
  readonly metadata: TargetLockMetadata
}

/**
 * 独占目标目录，并在发现已退出进程遗留的锁时恢复原目录
 *
 * @param cwd - 创建流程的工作目录
 * @param targetDir - 规范化后的目标目录
 * @returns 当前进程持有的目标锁
 * @throws {@link AppError} 目标正由其他进程处理或遗留状态无法安全恢复时抛出
 * @internal
 */
export async function acquireTargetLock(
  cwd: string,
  targetDir: string,
): Promise<TargetLock> {
  const lockPath = getTargetLockPath(cwd, targetDir)
  const metadata: TargetLockMetadata = {
    version: 1,
    ownerId: randomUUID(),
    pid: process.pid,
    hostname: hostname(),
    targetDir,
    targetExisted: await isPathExists(targetDir),
    createdAt: new Date().toISOString(),
  }

  let handle: FileHandle
  try {
    handle = await open(lockPath, 'wx', 0o600)
  } catch (error) {
    if (!hasCode(error, 'EEXIST')) {
      throw error
    }

    const existing = await readTargetLock(lockPath, targetDir)
    if (isOwnerRunning(existing)) {
      throw new AppError(`Target directory is already being created`, {
        code: 'CREATE_TARGET_LOCKED',
        details: { lockPath, ownerPid: existing.pid, targetDir },
      })
    }

    await recoverAbandonedTarget(cwd, existing)
    await remove(lockPath)
    return acquireTargetLock(cwd, targetDir)
  }

  try {
    try {
      await handle.writeFile(JSON.stringify(metadata))
    } finally {
      await handle.close()
    }
  } catch (error) {
    try {
      await remove(lockPath)
    } catch {
      // 保留原始写入错误，清理由下一次运行按遗留锁处理
    }
    throw error
  }

  return { path: lockPath, cwd, metadata }
}

/**
 * 在移动原目标前记录备份位置，使进程异常退出后可以恢复
 *
 * @param lock - 当前进程持有的目标锁
 * @param backupPath - 备份目录；恢复或提交完成后传入 `undefined`
 * @returns 元数据持久化完成后兑现的 Promise
 * @internal
 */
export async function updateTargetLockBackup(
  lock: TargetLock,
  backupPath: string | undefined,
): Promise<void> {
  lock.metadata.backupPath = backupPath
  await writeFile(lock.path, JSON.stringify(lock.metadata), {
    encoding: 'utf8',
    mode: 0o600,
  })
}

/**
 * 释放当前创建流程持有的目标锁
 *
 * @param lock - 当前进程持有的目标锁
 * @returns 锁文件移除后兑现的 Promise
 * @throws {@link AppError} 锁的所有者已变化时抛出，避免删除其他进程的锁
 * @internal
 */
export async function releaseTargetLock(lock: TargetLock): Promise<void> {
  if (!(await isPathExists(lock.path))) {
    return
  }

  const current = await readTargetLock(lock.path, lock.metadata.targetDir)
  if (current.ownerId !== lock.metadata.ownerId) {
    throw new AppError('Target lock ownership changed before release', {
      code: 'CREATE_TARGET_LOCKED',
      details: { lockPath: lock.path, targetDir: lock.metadata.targetDir },
    })
  }

  await remove(lock.path)
}

async function readTargetLock(
  lockPath: string,
  targetDir: string,
): Promise<TargetLockMetadata> {
  let value: unknown
  try {
    value = JSON.parse(await readFile(lockPath, 'utf8'))
  } catch (cause) {
    throw new AppError('Target lock metadata is unreadable', {
      cause,
      code: 'CREATE_TARGET_LOCKED',
      details: { lockPath, targetDir },
    })
  }

  if (!isTargetLockMetadata(value) || value.targetDir !== targetDir) {
    throw new AppError('Target lock metadata is invalid', {
      code: 'CREATE_TARGET_LOCKED',
      details: { lockPath, targetDir },
    })
  }

  return value
}

async function recoverAbandonedTarget(
  cwd: string,
  metadata: TargetLockMetadata,
): Promise<void> {
  const { backupPath, targetDir, targetExisted } = metadata

  if (backupPath) {
    const resolvedBackup = path.resolve(backupPath)
    if (
      path.dirname(resolvedBackup) !== path.resolve(cwd) ||
      !/^\.eljs-backup-[\da-f-]+$/u.test(path.basename(resolvedBackup))
    ) {
      throw new AppError('Target lock contains an unsafe backup path', {
        code: 'CREATE_RECOVERY_FAILED',
        details: { lockPath: getTargetLockPath(cwd, targetDir), targetDir },
      })
    }

    if (await isPathExists(resolvedBackup)) {
      await move(resolvedBackup, targetDir, true)
      return
    }
  }

  const targetExists = await isPathExists(targetDir)
  if (!targetExisted && targetExists) {
    await remove(targetDir)
  } else if (targetExisted && !targetExists) {
    throw new AppError('Original target is missing and cannot be recovered', {
      code: 'CREATE_RECOVERY_FAILED',
      details: { targetDir },
    })
  }
}

function getTargetLockPath(cwd: string, targetDir: string): string {
  const targetHash = createHash('sha256').update(targetDir).digest('hex')
  return path.join(path.resolve(cwd), `.eljs-create-${targetHash}.lock`)
}

function isOwnerRunning(metadata: TargetLockMetadata): boolean {
  if (metadata.hostname !== hostname()) {
    return true
  }

  try {
    process.kill(metadata.pid, 0)
    return true
  } catch (error) {
    return !hasCode(error, 'ESRCH')
  }
}

function isTargetLockMetadata(value: unknown): value is TargetLockMetadata {
  if (!value || typeof value !== 'object') {
    return false
  }

  const metadata = value as Partial<TargetLockMetadata>
  return (
    metadata.version === 1 &&
    typeof metadata.ownerId === 'string' &&
    Number.isSafeInteger(metadata.pid) &&
    (metadata.pid as number) > 0 &&
    typeof metadata.hostname === 'string' &&
    typeof metadata.targetDir === 'string' &&
    typeof metadata.targetExisted === 'boolean' &&
    typeof metadata.createdAt === 'string' &&
    (metadata.backupPath === undefined ||
      typeof metadata.backupPath === 'string')
  )
}

function hasCode(error: unknown, code: string): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === code
  )
}
