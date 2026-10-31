import { move, remove } from '@eljs/utils/file'
import { createHash, randomUUID } from 'node:crypto'
import {
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  type FileHandle,
} from 'node:fs/promises'
import { hostname } from 'node:os'
import path from 'node:path'

import { AppError } from '../errors'
import { resolveProspectiveCanonicalPath } from './canonical-path'

/**
 * 持久化到目标锁文件的恢复信息
 *
 * @remarks
 * 新锁使用 version 2，记录原始规范 `cwd`，跨工作目录恢复时仍按原边界验证备份
 * version 1 缺少阶段与 cwd，按 active 处理并从旧锁所在目录推断原 cwd
 * committing 只能保留新目标并清理备份；recovery-pending 表示前一流程已停止目标操作，
 * 即使其 PID 仍存活也可接管，恢复方向由 recoveryPhase 保留
 *
 * @internal
 */
interface TargetLockMetadata {
  readonly version: 1 | 2
  /** 用于临时文件和墓碑名称，只允许字母、数字、下划线与连字符 */
  readonly ownerId: string
  readonly pid: number
  readonly hostname: string
  readonly targetDir: string
  readonly targetExisted: boolean
  readonly createdAt: string
  readonly cwd?: string
  phase?: 'active' | 'committing' | 'recovery-pending'
  recoveryPhase?: 'active' | 'committing'
  backupPath?: string
}

/**
 * 持久化到目标锁获取互斥目录的所有者信息
 *
 * @remarks
 * 所有锁获取与遗留恢复都必须先持有该互斥目录，避免多个进程同时恢复时删除新锁
 * recovery-pending 仅在受保护操作停止后发布，允许仍存活的 PID 交接释放失败的 mutex
 *
 * @internal
 */
interface TargetLockMutexMetadata {
  readonly version: 1
  /** 唯一生命周期标识；只能使用可安全拼入私有墓碑路径的字符 */
  readonly ownerId: string
  readonly pid: number
  readonly hostname: string
  readonly createdAt: string
  phase?: 'recovery-pending'
}

/**
 * 当前进程持有的目标锁获取互斥目录
 *
 * @internal
 */
interface TargetLockMutex {
  readonly path: string
  readonly metadata: TargetLockMutexMetadata
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
  /** 目标操作已失败且恢复未完成；释放时交接恢复记录，调用方随后不得再操作目标 */
  recoveryRequired?: boolean
}

/**
 * 独占物理目标，并在发现遗留事务时按持久化阶段恢复
 *
 * @remarks
 * 锁位于规范目标父目录，与调用方 cwd 无关；会创建尚不存在的父目录
 * 调用方必须先校验目标位于允许的工作目录边界内
 * 兼容扫描目标祖先中的旧锁，但所有恢复均先持有新位置的获取互斥目录
 * 初始快照先写入所有者临时文件再原子发布，发布前退出不会留下半份公共锁
 * 释放获取 mutex 失败时，先交接尚未返回的目标锁，再交接 mutex；失败返回后可重试
 *
 * @param cwd - 创建流程的工作目录
 * @param targetDir - 目标目录；获取锁前会转换为规范物理路径
 * @returns 当前进程持有的目标锁
 * @throws {@link AppError} 目标正由其他进程处理或遗留状态无法安全恢复时抛出
 * @throws 文件系统错误原样传播，操作错误优先于 mutex 释放错误
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
  const lockPath = getTargetLockPath(
    path.dirname(canonicalTargetDir),
    canonicalTargetDir,
  )
  await mkdir(path.dirname(lockPath), { recursive: true })
  const mutex = await acquireTargetLockMutex(lockPath, canonicalTargetDir)

  let acquired: TargetLock | undefined
  return withTargetLockMutex(
    mutex,
    canonicalTargetDir,
    async () => {
      acquired = await acquireTargetLockExclusive(
        canonicalCwd,
        canonicalTargetDir,
        lockPath,
      )
      return acquired
    },
    async () => {
      if (acquired) {
        await writeTargetLockMetadata(acquired, {
          phase: 'recovery-pending',
          recoveryPhase: 'active',
        })
      }
    },
  )
}

/**
 * 持有统一 mutex 时恢复遗留记录并发布新目标锁
 *
 * @remarks
 * 恢复错误优先于额外获取的 mutex 释放错误，所有已获取的 mutex 均须停止操作后释放或交接
 * 返回值尚未交付调用方，外层必须等统一 mutex 释放成功后才允许目标操作
 */
async function acquireTargetLockExclusive(
  canonicalCwd: string,
  canonicalTargetDir: string,
  lockPath: string,
): Promise<TargetLock> {
  const legacyMutexes: TargetLockMutex[] = []
  let recoveryFailed = false
  let recoveryError: unknown
  try {
    const records: { path: string; metadata: TargetLockMetadata }[] = []
    // 新位置始终是统一并发边界；检查活跃新锁后才允许触碰旧位置
    if (await entryExists(lockPath)) {
      const existing = await readTargetLock(lockPath, canonicalTargetDir)
      assertRecoverableOwner(existing, lockPath)
      records.push({ path: lockPath, metadata: existing })
    }

    for (const legacyPath of getLegacyTargetLockPaths(canonicalTargetDir)) {
      if (legacyPath === lockPath) {
        continue
      }
      if (
        !(await entryExists(legacyPath)) &&
        !(await entryExists(`${legacyPath}.acquire`))
      ) {
        continue
      }
      // 与仍使用旧协议的获取流程互斥，不能仅凭旧锁不存在就绕过其获取窗口
      legacyMutexes.push(
        await acquireTargetLockMutex(legacyPath, canonicalTargetDir),
      )
      if (await entryExists(legacyPath)) {
        const existing = await readTargetLock(legacyPath, canonicalTargetDir)
        assertRecoverableOwner(existing, legacyPath)
        records.push({ path: legacyPath, metadata: existing })
      }
    }

    if (records.length > 1) {
      throw new AppError(
        'Multiple target recovery records require manual reconciliation',
        {
          code: 'CREATE_RECOVERY_FAILED',
          details: {
            targetDir: canonicalTargetDir,
            lockPaths: records.map(record => record.path),
          },
        },
      )
    }
    for (const record of records) {
      try {
        await recoverAbandonedTarget(record.path, record.metadata)
      } catch (cause) {
        if (
          cause instanceof AppError &&
          cause.code === 'CREATE_RECOVERY_FAILED'
        ) {
          throw cause
        }
        throw new AppError('Target transaction recovery failed', {
          cause,
          code: 'CREATE_RECOVERY_FAILED',
          details: { lockPath: record.path, targetDir: canonicalTargetDir },
        })
      }
      await remove(
        getTargetLockUpdatePath(record.path, record.metadata.ownerId),
      )
      await remove(record.path)
    }
  } catch (error) {
    recoveryFailed = true
    recoveryError = error
  }
  for (const legacyMutex of legacyMutexes.reverse()) {
    try {
      await releaseTargetLockMutex(legacyMutex, canonicalTargetDir)
    } catch (error) {
      if (!recoveryFailed) {
        recoveryFailed = true
        recoveryError = error
      }
    }
  }
  if (recoveryFailed) {
    throw recoveryError
  }

  const metadata: TargetLockMetadata = {
    version: 2,
    ownerId: randomUUID(),
    pid: process.pid,
    hostname: hostname(),
    targetDir: canonicalTargetDir,
    targetExisted: await entryExists(canonicalTargetDir),
    createdAt: new Date().toISOString(),
    cwd: canonicalCwd,
    phase: 'active',
  }

  const updatePath = getTargetLockUpdatePath(lockPath, metadata.ownerId)
  let handle: FileHandle | undefined
  try {
    handle = await open(updatePath, 'wx', 0o600)
    await handle.writeFile(JSON.stringify(metadata))
    await handle.sync()
    await handle.close()
    handle = undefined

    if (await entryExists(lockPath)) {
      throw new AppError('Target directory is already being created', {
        code: 'CREATE_TARGET_LOCKED',
        details: { lockPath, targetDir: canonicalTargetDir },
      })
    }
    // 获取 mutex 内只发布完整元数据；目标操作尚未开始，无需恢复未发布的临时文件
    await rename(updatePath, lockPath)
  } catch (error) {
    await handle?.close().catch(() => undefined)
    await remove(updatePath).catch(() => undefined)
    throw error
  }

  return { path: lockPath, cwd: canonicalCwd, metadata }
}

function assertRecoverableOwner(
  metadata: TargetLockMetadata,
  lockPath: string,
): void {
  if (metadata.phase !== 'recovery-pending' && isOwnerRunning(metadata)) {
    throw new AppError('Target directory is already being created', {
      code: 'CREATE_TARGET_LOCKED',
      details: {
        lockPath,
        ownerPid: metadata.pid,
        targetDir: metadata.targetDir,
      },
    })
  }
}

/**
 * 枚举同一物理目标在旧协议下可能使用的祖先 cwd 锁位置
 *
 * @remarks
 * 不依赖本次 cwd，避免从另一祖先启动时遗失旧恢复记录
 */
function getLegacyTargetLockPaths(targetDir: string): string[] {
  const paths: string[] = []
  let ancestor = path.dirname(targetDir)
  while (true) {
    paths.push(getTargetLockPath(ancestor, targetDir))
    const parent = path.dirname(ancestor)
    if (parent === ancestor) {
      return paths
    }
    ancestor = parent
  }
}

/**
 * 通过完整候选目录的原子改名独占获取与协议转换
 *
 * @remarks
 * 活跃或不完整的 mutex 不自动回收；退出所有者的目录改到不可变墓碑，
 * 避免延迟竞争者删除后继所有者的公共路径
 */
async function acquireTargetLockMutex(
  lockPath: string,
  targetDir: string,
): Promise<TargetLockMutex> {
  const mutexPath = `${lockPath}.acquire`
  const metadata: TargetLockMutexMetadata = {
    version: 1,
    ownerId: randomUUID(),
    pid: process.pid,
    hostname: hostname(),
    createdAt: new Date().toISOString(),
  }
  const candidatePath = `${mutexPath}.${metadata.ownerId}.tmp`
  const candidateMetadataPath = path.join(candidatePath, 'owner.json')

  await mkdir(candidatePath, { mode: 0o700 })
  try {
    const handle = await open(candidateMetadataPath, 'wx', 0o600)
    try {
      await handle.writeFile(JSON.stringify(metadata))
      await handle.sync()
    } finally {
      await handle.close()
    }

    // rename 可覆盖空目录；先拒绝已观察到的不完整 mutex，不能吞掉其恢复线索
    if (!(await entryExists(mutexPath))) {
      try {
        await rename(candidatePath, mutexPath)
        return {
          path: mutexPath,
          metadata,
        }
      } catch (error) {
        if (!isExistingPathError(error)) {
          throw error
        }
      }
    }
  } finally {
    await remove(candidatePath).catch(() => undefined)
  }

  const metadataPath = path.join(mutexPath, 'owner.json')
  const existing = await readTargetLockMutex(metadataPath, targetDir)
  if (existing.phase !== 'recovery-pending' && isOwnerRunning(existing)) {
    throw new AppError('Target directory lock is being acquired', {
      code: 'CREATE_TARGET_LOCKED',
      details: {
        lockPath,
        ownerPid: existing.pid,
        targetDir,
      },
    })
  }

  const abandonedPath = `${mutexPath}.${existing.ownerId}.abandoned`
  try {
    // 保留不可变墓碑，使读取了旧 ownerId 的延迟竞争者不能把后继互斥目录改到同一路径并误删
    await rename(mutexPath, abandonedPath)
  } catch (error) {
    if (hasCode(error, 'ENOENT') || isExistingPathError(error)) {
      return acquireTargetLockMutex(lockPath, targetDir)
    }
    throw error
  }

  return acquireTargetLockMutex(lockPath, targetDir)
}

/**
 * 校验当前生命周期后释放公共获取路径，失败则尝试交接已停止的操作
 *
 * @remarks
 * 只有 rename 释放失败才尝试交接，不接管不可读取或所有权已变化的 mutex
 * beforeHandoff 必须先保留未交付目标锁的恢复方向，成功后才能发布 mutex 的 pending 状态
 * 交接失败保留原记录并传播原始释放错误，私有 released 墓碑清理按 best-effort 执行
 */
async function releaseTargetLockMutex(
  mutex: TargetLockMutex,
  targetDir: string,
  beforeHandoff?: () => Promise<void>,
): Promise<void> {
  const current = await readTargetLockMutex(
    path.join(mutex.path, 'owner.json'),
    targetDir,
  )
  if (current.ownerId !== mutex.metadata.ownerId) {
    throw new AppError('Target lock acquisition ownership changed', {
      code: 'CREATE_TARGET_LOCKED',
      details: { lockPath: mutex.path, targetDir },
    })
  }

  const releasedPath = `${mutex.path}.${mutex.metadata.ownerId}.released`

  // 原子改名先释放公共互斥路径，延迟清理只能作用于当前 owner 的私有墓碑
  try {
    await rename(mutex.path, releasedPath)
  } catch (error) {
    // 尚未交付的目标锁必须先转为可恢复记录，否则接管 mutex 后仍会被本进程的 active 锁阻塞
    try {
      await beforeHandoff?.()
      await handoffTargetLockMutex(mutex, targetDir)
    } catch {
      // 交接失败保留公共目录和原恢复记录，不能删锁或用次生错误覆盖原始释放错误
    }
    throw error
  }
  await remove(releasedPath).catch(() => undefined)
}

/**
 * 受保护操作停止后原子交接释放失败的获取 mutex
 *
 * @remarks
 * 只更新仍属于当前生命周期的 owner 快照，不删除未知所有者
 * 发布失败时保留原记录；成功后接管仍通过不可变墓碑隔离延迟竞争者
 */
async function handoffTargetLockMutex(
  mutex: TargetLockMutex,
  targetDir: string,
): Promise<void> {
  const metadataPath = path.join(mutex.path, 'owner.json')
  const current = await readTargetLockMutex(metadataPath, targetDir)
  if (current.ownerId !== mutex.metadata.ownerId) {
    throw new AppError('Target lock acquisition ownership changed', {
      code: 'CREATE_TARGET_LOCKED',
      details: { lockPath: mutex.path, targetDir },
    })
  }
  const updatePath = path.join(mutex.path, `${current.ownerId}.tmp`)
  let handle: FileHandle | undefined
  try {
    handle = await open(updatePath, 'wx', 0o600)
    await handle.writeFile(
      JSON.stringify({ ...current, phase: 'recovery-pending' }),
    )
    await handle.sync()
    await handle.close()
    handle = undefined
    await rename(updatePath, metadataPath)
  } finally {
    await handle?.close().catch(() => undefined)
    await remove(updatePath).catch(() => undefined)
  }
}

/**
 * 保持操作错误优先，并在操作停止后释放或交接获取 mutex
 *
 * @remarks
 * beforeHandoff 用于先交接尚未交付调用方的目标锁，避免 mutex 接管早于目标记录交接
 */
async function withTargetLockMutex<T>(
  mutex: TargetLockMutex,
  targetDir: string,
  operation: () => Promise<T>,
  beforeHandoff?: () => Promise<void>,
): Promise<T> {
  let result: T
  try {
    result = await operation()
  } catch (error) {
    await releaseTargetLockMutex(mutex, targetDir, beforeHandoff).catch(
      () => undefined,
    )
    throw error
  }
  await releaseTargetLockMutex(mutex, targetDir, beforeHandoff)
  return result
}

async function readTargetLockMutex(
  metadataPath: string,
  targetDir: string,
): Promise<TargetLockMutexMetadata> {
  let value: unknown
  try {
    value = JSON.parse(await readFile(metadataPath, 'utf8'))
  } catch (cause) {
    throw new AppError('Target lock acquisition metadata is unreadable', {
      cause,
      code: 'CREATE_TARGET_LOCKED',
      details: { lockPath: path.dirname(metadataPath), targetDir },
    })
  }

  if (!isTargetLockMutexMetadata(value)) {
    throw new AppError('Target lock acquisition metadata is invalid', {
      code: 'CREATE_TARGET_LOCKED',
      details: { lockPath: path.dirname(metadataPath), targetDir },
    })
  }

  return value
}

/**
 * 在移动原目标前记录备份位置，使进程异常退出后可以恢复
 *
 * @remarks
 * 持有获取 mutex 原子更新完整快照，不改变事务阶段；pending 交接后禁止旧所有者更新
 * mutex 释放失败后可重试释放，但已持久化的更新不会撤销
 *
 * @param lock - 当前进程持有的目标锁
 * @param backupPath - 备份目录；恢复或提交完成后传入 `undefined`
 * @returns 元数据持久化完成后兑现的 Promise
 * @throws {@link AppError} 所有权已变化或已交接恢复时抛出
 * @internal
 */
export async function updateTargetLockBackup(
  lock: TargetLock,
  backupPath: string | undefined,
): Promise<void> {
  const mutex = await acquireTargetLockMutex(lock.path, lock.metadata.targetDir)
  await withTargetLockMutex(mutex, lock.metadata.targetDir, async () => {
    await writeTargetLockMetadata(lock, { backupPath })
  })
}

/**
 * 原子持久化提交阶段，之后禁止用备份覆盖新目标
 *
 * @remarks
 * mutex 释放失败不会撤销已持久化的提交阶段，后续恢复仍须保留新目标
 *
 * @param lock - 当前进程持有的目标锁
 * @returns 阶段持久化后兑现的 Promise；调用方必须等待后才能删除备份
 * @throws {@link AppError} 所有权或事务阶段已变化时抛出
 * @internal
 */
export async function commitTargetLock(lock: TargetLock): Promise<void> {
  const mutex = await acquireTargetLockMutex(lock.path, lock.metadata.targetDir)
  await withTargetLockMutex(mutex, lock.metadata.targetDir, async () => {
    await writeTargetLockMetadata(lock, { phase: 'committing' })
  })
}

/**
 * 持有获取互斥目录时更新当前所有者的完整协议快照
 *
 * @remarks
 * 使用当前磁盘版本合并修改，原子 rename 发布；pending 交接后旧所有者不能再更新
 */
async function writeTargetLockMetadata(
  lock: TargetLock,
  changes: Partial<
    Pick<TargetLockMetadata, 'backupPath' | 'phase' | 'recoveryPhase'>
  >,
): Promise<void> {
  const current = await readTargetLock(lock.path, lock.metadata.targetDir)
  if (
    current.ownerId !== lock.metadata.ownerId ||
    current.phase === 'recovery-pending'
  ) {
    throw new AppError('Target lock ownership changed before update', {
      code: 'CREATE_TARGET_LOCKED',
      details: { lockPath: lock.path, targetDir: lock.metadata.targetDir },
    })
  }

  const nextMetadata: TargetLockMetadata = {
    ...current,
    ...changes,
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
    Object.assign(lock.metadata, nextMetadata)
  } catch (error) {
    await handle?.close().catch(() => undefined)
    await remove(updatePath).catch(() => undefined)
    throw error
  }
}

/**
 * 释放目标锁，或在恢复失败时原子交接为可回收记录
 *
 * @remarks
 * 调用方须先停止所有目标操作；recoveryRequired 为真时保留备份与恢复方向，
 * 之后同进程或其他进程均可持有获取互斥目录后重试，原所有者不得再次操作目标
 *
 * @param lock - 当前进程持有的目标锁
 * @returns 锁文件移除或恢复记录交接完成后兑现的 Promise
 * @throws {@link AppError} 锁的所有者已变化时抛出，避免删除其他进程的锁
 * @internal
 */
export async function releaseTargetLock(lock: TargetLock): Promise<void> {
  const mutex = await acquireTargetLockMutex(lock.path, lock.metadata.targetDir)
  await withTargetLockMutex(mutex, lock.metadata.targetDir, async () => {
    if (!(await entryExists(lock.path))) {
      return
    }

    const current = await readTargetLock(lock.path, lock.metadata.targetDir)
    if (
      current.ownerId !== lock.metadata.ownerId ||
      current.phase === 'recovery-pending'
    ) {
      throw new AppError('Target lock ownership changed before release', {
        code: 'CREATE_TARGET_LOCKED',
        details: { lockPath: lock.path, targetDir: lock.metadata.targetDir },
      })
    }

    if (lock.recoveryRequired) {
      await writeTargetLockMetadata(lock, {
        phase: 'recovery-pending',
        recoveryPhase: current.phase === 'committing' ? 'committing' : 'active',
      })
    } else {
      try {
        await remove(lock.path)
      } catch (error) {
        // 目标操作已停止，单独的删锁失败也不能留下同进程永远无法回收的活跃锁
        await writeTargetLockMetadata(lock, {
          phase: 'recovery-pending',
          recoveryPhase:
            current.phase === 'committing' ? 'committing' : 'active',
        }).catch(() => undefined)
        throw error
      }
    }
  })
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

/**
 * 持有新锁和旧位置获取互斥目录时恢复遗留事务
 *
 * @remarks
 * 原 cwd 必须仍是规范目标的严格祖先，备份必须是原 cwd 直属的专用路径
 * 提交阶段即使备份尚存也不得回滚，失败时保留锁供后续重试
 * active 恢复先删除可丢弃的半成品，再无覆盖移动备份；两步之间退出仍可按原记录重试
 */
async function recoverAbandonedTarget(
  lockPath: string,
  metadata: TargetLockMetadata,
): Promise<void> {
  const { backupPath, targetDir, targetExisted } = metadata
  const originalCwd =
    metadata.version === 1 ? path.dirname(lockPath) : (metadata.cwd as string)
  const canonicalCwd = await resolveProspectiveCanonicalPath(originalCwd)
  const canonicalTarget = await resolveProspectiveCanonicalPath(targetDir)
  const relativeTarget = path.relative(canonicalCwd, targetDir)
  if (
    canonicalCwd !== originalCwd ||
    canonicalTarget !== targetDir ||
    !relativeTarget ||
    relativeTarget === '..' ||
    relativeTarget.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeTarget)
  ) {
    throw new AppError('Target lock contains an unsafe original cwd', {
      code: 'CREATE_RECOVERY_FAILED',
      details: { lockPath, targetDir, cwd: originalCwd },
    })
  }

  let resolvedBackup: string | undefined
  if (backupPath) {
    resolvedBackup = await resolveProspectiveCanonicalPath(backupPath)
    if (
      path.dirname(resolvedBackup) !== canonicalCwd ||
      isSameOrDescendant(resolvedBackup, targetDir) ||
      isSameOrDescendant(targetDir, resolvedBackup) ||
      !/^\.eljs-backup-[\da-f-]+$/u.test(path.basename(resolvedBackup))
    ) {
      throw new AppError('Target lock contains an unsafe backup path', {
        code: 'CREATE_RECOVERY_FAILED',
        details: { lockPath, targetDir },
      })
    }
  }

  const phase =
    metadata.phase === 'recovery-pending'
      ? metadata.recoveryPhase
      : metadata.phase
  if (phase === 'committing') {
    if (!(await entryExists(targetDir))) {
      throw new AppError(
        'Committed target is missing and cannot be recovered from backup',
        {
          code: 'CREATE_RECOVERY_FAILED',
          details: { lockPath, targetDir, backupPath },
        },
      )
    }
    if (resolvedBackup) {
      await remove(resolvedBackup)
    }
    return
  }

  if (resolvedBackup) {
    if (await entryExists(resolvedBackup)) {
      await remove(targetDir)
      await move(resolvedBackup, targetDir, false)
      return
    }
  }

  const targetExists = await entryExists(targetDir)
  if (!targetExisted && targetExists) {
    await remove(targetDir)
  } else if (targetExisted && !targetExists) {
    throw new AppError('Original target is missing and cannot be recovered', {
      code: 'CREATE_RECOVERY_FAILED',
      details: { targetDir },
    })
  }
}

/**
 * 按规范物理目标生成稳定哈希名，供新父目录位置和旧 cwd 位置共用
 */
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

function isOwnerRunning(
  metadata: Pick<TargetLockMetadata, 'hostname' | 'pid'>,
): boolean {
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
    ((metadata.version === 1 &&
      metadata.phase === undefined &&
      metadata.recoveryPhase === undefined) ||
      (metadata.version === 2 &&
        typeof metadata.cwd === 'string' &&
        path.isAbsolute(metadata.cwd) &&
        (metadata.phase === 'active' ||
          metadata.phase === 'committing' ||
          (metadata.phase === 'recovery-pending' &&
            (metadata.recoveryPhase === 'active' ||
              metadata.recoveryPhase === 'committing'))))) &&
    typeof metadata.ownerId === 'string' &&
    /^[\w-]+$/u.test(metadata.ownerId) &&
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

function isTargetLockMutexMetadata(
  value: unknown,
): value is TargetLockMutexMetadata {
  if (!value || typeof value !== 'object') {
    return false
  }

  const metadata = value as Partial<TargetLockMutexMetadata>
  return (
    metadata.version === 1 &&
    (metadata.phase === undefined || metadata.phase === 'recovery-pending') &&
    typeof metadata.ownerId === 'string' &&
    /^[\w-]+$/u.test(metadata.ownerId) &&
    Number.isSafeInteger(metadata.pid) &&
    (metadata.pid as number) > 0 &&
    typeof metadata.hostname === 'string' &&
    typeof metadata.createdAt === 'string'
  )
}

function isExistingPathError(error: unknown): boolean {
  return (
    hasCode(error, 'EEXIST') ||
    hasCode(error, 'ENOTEMPTY') ||
    hasCode(error, 'EPERM')
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

/**
 * 检查协议路径是否存在，仅将 ENOENT 视为缺失
 *
 * @remarks
 * 权限错误必须传播，悬空符号链接仍占用路径，避免把不可读取的锁误判为可接管
 */
async function entryExists(candidate: string): Promise<boolean> {
  try {
    await lstat(candidate)
    return true
  } catch (error) {
    if (hasCode(error, 'ENOENT')) {
      return false
    }
    throw error
  }
}

function isSameOrDescendant(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate)
  return (
    !relative ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  )
}
