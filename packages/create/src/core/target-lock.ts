import { move, pathExists, remove } from '@eljs/utils/file'
import { createHash, randomUUID } from 'node:crypto'
import { open, readFile, rename, type FileHandle } from 'node:fs/promises'
import { hostname } from 'node:os'
import path from 'node:path'

import { AppError } from '../errors'
import { resolveProspectiveCanonicalPath } from './canonical-path'

/**
 * 持久化到目标锁文件的恢复信息
 *
 * @remarks
 * `targetDir` 持久化为规范物理路径；`backupPath` 只允许解析到工作目录直属的
 * `.eljs-backup-*` 路径，避免路径别名或锁文件篡改导致移动任意目录
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
  /** 锁文件的规范绝对路径 */
  readonly path: string
  /** 解析符号链接后的工作目录 */
  readonly cwd: string
  /** 当前所有者持久化的恢复元数据 */
  readonly metadata: TargetLockMetadata
}

/**
 * 独占目标目录，并在发现已退出进程遗留的锁时恢复原目录
 *
 * @param cwd - 创建流程的工作目录
 * @param targetDir - 目标目录；获取锁前会转换为规范物理路径
 * @returns 当前进程持有的目标锁
 * @throws {@link AppError} 目标正由其他进程处理或遗留状态无法安全恢复时抛出
 * @internal
 */
export async function acquireTargetLock(
  cwd: string,
  targetDir: string,
): Promise<TargetLock> {
  const [canonicalCwd, canonicalTargetDir] = await Promise.all([
    resolveProspectiveCanonicalPath(cwd),
    resolveProspectiveCanonicalPath(targetDir),
  ])
  const lockPath = getTargetLockPath(canonicalCwd, canonicalTargetDir)
  const metadata: TargetLockMetadata = {
    version: 1,
    ownerId: randomUUID(),
    pid: process.pid,
    hostname: hostname(),
    targetDir: canonicalTargetDir,
    targetExisted: await pathExists(canonicalTargetDir),
    createdAt: new Date().toISOString(),
  }

  let handle: FileHandle
  try {
    handle = await open(lockPath, 'wx', 0o600)
  } catch (error) {
    if (!hasCode(error, 'EEXIST')) {
      throw error
    }

    const existing = await readTargetLock(lockPath, canonicalTargetDir)
    if (isOwnerRunning(existing)) {
      throw new AppError(`Target directory is already being created`, {
        code: 'CREATE_TARGET_LOCKED',
        details: {
          lockPath,
          ownerPid: existing.pid,
          targetDir: canonicalTargetDir,
        },
      })
    }

    await recoverAbandonedTarget(canonicalCwd, existing)
    await remove(getTargetLockUpdatePath(lockPath, existing.ownerId))
    await remove(lockPath)
    return acquireTargetLock(canonicalCwd, canonicalTargetDir)
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

  return { path: lockPath, cwd: canonicalCwd, metadata }
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
  const current = await readTargetLock(lock.path, lock.metadata.targetDir)
  if (current.ownerId !== lock.metadata.ownerId) {
    throw new AppError('Target lock ownership changed before update', {
      code: 'CREATE_TARGET_LOCKED',
      details: { lockPath: lock.path, targetDir: lock.metadata.targetDir },
    })
  }

  const nextMetadata: TargetLockMetadata = {
    ...lock.metadata,
    backupPath,
  }
  const updatePath = getTargetLockUpdatePath(lock.path, lock.metadata.ownerId)
  let handle: FileHandle | undefined

  try {
    handle = await open(updatePath, 'wx', 0o600)
    await handle.writeFile(JSON.stringify(nextMetadata))
    await handle.sync()
    await handle.close()
    handle = undefined

    const latest = await readTargetLock(lock.path, lock.metadata.targetDir)
    if (latest.ownerId !== lock.metadata.ownerId) {
      throw new AppError('Target lock ownership changed before update', {
        code: 'CREATE_TARGET_LOCKED',
        details: { lockPath: lock.path, targetDir: lock.metadata.targetDir },
      })
    }

    // 同目录 rename 只会暴露完整的新旧版本，进程退出不会留下半份恢复元数据
    await rename(updatePath, lock.path)
    lock.metadata.backupPath = backupPath
  } catch (error) {
    await handle?.close().catch(() => undefined)
    await remove(updatePath).catch(() => undefined)
    throw error
  }
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
  if (!(await pathExists(lock.path))) {
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
    const resolvedBackup = await resolveProspectiveCanonicalPath(backupPath)
    if (
      path.dirname(resolvedBackup) !== path.resolve(cwd) ||
      !/^\.eljs-backup-[\da-f-]+$/u.test(path.basename(resolvedBackup))
    ) {
      throw new AppError('Target lock contains an unsafe backup path', {
        code: 'CREATE_RECOVERY_FAILED',
        details: { lockPath: getTargetLockPath(cwd, targetDir), targetDir },
      })
    }

    if (await pathExists(resolvedBackup)) {
      await move(resolvedBackup, targetDir, true)
      return
    }
  }

  const targetExists = await pathExists(targetDir)
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

/**
 * 为锁元数据原子更新生成与锁文件同目录的稳定临时路径
 *
 * @param lockPath - 当前锁文件路径
 * @param ownerId - 当前锁所有者的随机标识
 * @returns 仅由当前所有者使用的临时文件路径
 */
function getTargetLockUpdatePath(lockPath: string, ownerId: string): string {
  return `${lockPath}.${ownerId}.tmp`
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
