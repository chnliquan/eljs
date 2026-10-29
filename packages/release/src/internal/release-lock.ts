import { createHash, randomUUID } from 'node:crypto'
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  unlink,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout } from 'node:timers/promises'

import { AppError } from '../utils'

/**
 * 发布锁文件中用于判断持有者和校验所有权的元数据
 *
 * @remarks
 * 元数据会跨进程写入临时目录，读取方必须将其视为不可信输入
 *
 * @internal
 */
interface LockMetadata {
  /** 申请发布锁时解析得到的绝对工作目录 */
  cwd: string
  /** 发布锁创建时间的 ISO 8601 字符串 */
  createdAt: string
  /** 持有发布锁的进程 ID */
  pid: number
  /** 防止其他进程误删当前发布锁的随机所有权令牌 */
  token: string
}

const staleInvalidLockMs = 30_000

/**
 * 原子发布到互斥目录的不可变所有者协议
 *
 * @remarks
 * 候选目录写入完整元数据后才能改名为公共路径，崩溃回收必须保留 ownerId 墓碑
 * ownerId 仅允许 UUID，防止不可信元数据影响墓碑路径
 *
 * @internal
 */
interface MutexMetadata {
  readonly ownerId: string
  readonly pid: number
}

/**
 * 当前工作目录的跨进程发布锁
 *
 * @remarks
 * 获取、遗留回收和释放共享同一互斥，所有权检查到删除之间不允许后继锁进入
 *
 * @internal
 */
export class ReleaseLock {
  private constructor(
    private readonly _path: string,
    private readonly _token: string,
  ) {}

  /**
   * 为工作目录获取独占发布锁
   *
   * @param cwd - 发布工作目录
   * @returns 已持有的发布锁
   * @throws {@link AppError}
   * 当另一个存活进程正在发布相同工作目录、互斥等待超时或目录不安全时抛出
   */
  public static async acquire(cwd: string): Promise<ReleaseLock> {
    // 真实路径可让符号链接和平台路径别名共享同一把跨进程锁
    const resolvedCwd = await realpath(path.resolve(cwd))
    const userNamespace =
      typeof process.getuid === 'function' ? process.getuid() : 'default'
    const lockRoot = path.join(tmpdir(), `eljs-release-locks-${userNamespace}`)
    const lockName = `${createHash('sha256')
      .update(resolvedCwd)
      .digest('hex')}.json`
    const lockPath = path.join(lockRoot, lockName)
    await mkdir(lockRoot, { recursive: true, mode: 0o700 })
    const lockRootStat = await lstat(lockRoot)

    if (
      !lockRootStat.isDirectory() ||
      (typeof process.getuid === 'function' &&
        lockRootStat.uid !== process.getuid())
    ) {
      throw new AppError(`Unsafe release lock directory ${lockRoot}.`)
    }

    if (process.platform !== 'win32') {
      await chmod(lockRoot, 0o700)
    }

    const mutex = await acquireMutex(lockPath)
    try {
      return await ReleaseLock._acquireExclusive(lockPath, resolvedCwd)
    } finally {
      await releaseMutex(lockPath, mutex)
    }
  }

  /** 持有获取互斥后创建或回收发布锁，公共路径修改必须留在此临界区 */
  private static async _acquireExclusive(
    lockPath: string,
    resolvedCwd: string,
  ): Promise<ReleaseLock> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = randomUUID()

      try {
        const handle = await open(lockPath, 'wx', 0o600)
        const metadata: LockMetadata = {
          cwd: resolvedCwd,
          createdAt: new Date().toISOString(),
          pid: process.pid,
          token,
        }

        try {
          await handle.writeFile(JSON.stringify(metadata))
          await handle.close()
        } catch (error) {
          await handle.close().catch(() => undefined)
          await unlink(lockPath).catch(() => undefined)
          throw error
        }

        return new ReleaseLock(lockPath, token)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw error
        }

        if (attempt === 0 && (await removeStaleLock(lockPath, resolvedCwd))) {
          continue
        }

        throw new AppError(
          `Another release process is already running in ${resolvedCwd}.`,
        )
      }
    }

    throw new AppError(`Unable to acquire the release lock for ${resolvedCwd}.`)
  }

  /**
   * 释放当前进程持有的发布锁
   *
   * @remarks
   * 在互斥内校验令牌并删除，重复释放或所有权变化时保留后继锁
   */
  public async release(): Promise<void> {
    const mutex = await acquireMutex(this._path)
    try {
      const metadata: unknown = JSON.parse(await readFile(this._path, 'utf8'))

      if (
        metadata !== null &&
        typeof metadata === 'object' &&
        'token' in metadata &&
        metadata.token === this._token
      ) {
        await unlink(this._path)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    } finally {
      await releaseMutex(this._path, mutex)
    }
  }
}

/**
 * 串行化公共锁路径的全部修改，并恢复已退出进程遗留的互斥
 *
 * @remarks
 * 非空目录 rename 不覆盖既有目录；旧 ownerId 的墓碑永久保留，使延迟回收者
 * 对同一墓碑的 rename 失败，无法移动或删除后继互斥
 * 竞争期间最多等待五秒，完整元数据通过候选目录发布前不会暴露在公共路径
 * 发布候选前必须确认公共路径不存在，既有空目录或缺损元数据不得被 rename 覆盖
 */
async function acquireMutex(lockPath: string): Promise<MutexMetadata> {
  const root = await lstat(path.dirname(lockPath))
  if (
    !root.isDirectory() ||
    (typeof process.getuid === 'function' && root.uid !== process.getuid()) ||
    (process.platform !== 'win32' && (root.mode & 0o077) !== 0)
  ) {
    throw new AppError(
      `Unsafe release lock directory ${path.dirname(lockPath)}.`,
    )
  }
  const mutexPath = `${lockPath}.acquire`
  const metadata: MutexMetadata = { ownerId: randomUUID(), pid: process.pid }
  const candidatePath = `${mutexPath}.${metadata.ownerId}.tmp`
  await mkdir(candidatePath, { mode: 0o700 })

  try {
    const handle = await open(
      path.join(candidatePath, 'owner.json'),
      'wx',
      0o600,
    )
    try {
      await handle.writeFile(JSON.stringify(metadata))
      await handle.sync()
    } finally {
      await handle.close()
    }

    const deadline = Date.now() + 5_000
    while (true) {
      if (Date.now() >= deadline) {
        throw new AppError(`Release lock is being acquired for ${lockPath}.`)
      }
      let existing: MutexMetadata
      try {
        existing = await readMutex(mutexPath)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error
        }

        try {
          // POSIX rename 可覆盖空目录，因此只能在确认公共路径不存在后发布完整候选
          await rename(candidatePath, mutexPath)
          return metadata
        } catch (publishError) {
          if (
            (publishError as NodeJS.ErrnoException).code !== 'ENOENT' &&
            !isExistingPathError(publishError)
          ) {
            throw publishError
          }
        }
        continue
      }

      if (!isProcessAlive(existing.pid)) {
        try {
          // 墓碑不可删除，否则读过旧 ownerId 的竞争者可能移动后继目录
          await rename(mutexPath, `${mutexPath}.${existing.ownerId}.abandoned`)
        } catch (error) {
          if (
            (error as NodeJS.ErrnoException).code !== 'ENOENT' &&
            !isExistingPathError(error)
          ) {
            throw error
          }
        }
      } else {
        await setTimeout(10)
      }
    }
  } finally {
    await rm(candidatePath, { recursive: true, force: true }).catch(
      () => undefined,
    )
  }
}

/**
 * 读取不可信互斥协议，缺损元数据拒绝回收以避免误判活跃持有者
 *
 * @remarks
 * 仅在 lstat 确认公共路径不存在时传播 ENOENT，目录换代时重新校验元数据，
 * 防止调用方把缺损记录当作不存在并覆盖公共路径
 */
async function readMutex(mutexPath: string): Promise<MutexMetadata> {
  const directory = await lstat(mutexPath)
  if (
    !directory.isDirectory() ||
    (typeof process.getuid === 'function' &&
      directory.uid !== process.getuid()) ||
    (process.platform !== 'win32' && (directory.mode & 0o077) !== 0)
  ) {
    throw new AppError(`Unsafe release mutex directory ${mutexPath}.`)
  }
  let value: unknown
  try {
    value = JSON.parse(
      await readFile(path.join(mutexPath, 'owner.json'), 'utf8'),
    )
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const latest = await lstat(mutexPath)
      if (latest.ino !== directory.ino || latest.dev !== directory.dev) {
        return readMutex(mutexPath)
      }
      throw new AppError(`Incomplete release mutex metadata ${mutexPath}.`)
    }
    throw error
  }
  const metadata = value as Partial<MutexMetadata> | null
  if (
    !metadata ||
    typeof metadata.ownerId !== 'string' ||
    !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/u.test(metadata.ownerId) ||
    !Number.isSafeInteger(metadata.pid) ||
    (metadata.pid as number) <= 0
  ) {
    throw new AppError(`Invalid release mutex metadata ${mutexPath}.`)
  }
  return metadata as MutexMetadata
}

/**
 * 原子释放互斥公共路径，清理仅作用于当前所有者的私有目录
 */
async function releaseMutex(
  lockPath: string,
  metadata: MutexMetadata,
): Promise<void> {
  const mutexPath = `${lockPath}.acquire`
  const current = await readMutex(mutexPath)
  if (current.ownerId !== metadata.ownerId) {
    throw new AppError(`Release mutex ownership changed for ${lockPath}.`)
  }
  const releasedPath = `${mutexPath}.${metadata.ownerId}.released`
  await rename(mutexPath, releasedPath)
  await rm(releasedPath, { recursive: true, force: true }).catch(
    () => undefined,
  )
}

function isExistingPathError(error: unknown): boolean {
  return ['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(
    (error as NodeJS.ErrnoException).code ?? '',
  )
}

/**
 * 仅在持有获取互斥时检查并回收旧锁，避免读后删除后继锁
 */
async function removeStaleLock(
  lockPath: string,
  expectedCwd: string,
): Promise<boolean> {
  try {
    const metadata: unknown = JSON.parse(await readFile(lockPath, 'utf8'))

    if (!isLockMetadata(metadata, expectedCwd)) {
      return removeInvalidLockIfStale(lockPath)
    }

    if (isProcessAlive(metadata.pid)) {
      return false
    }

    await unlink(lockPath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return true
    }

    return removeInvalidLockIfStale(lockPath)
  }
}

/**
 * 校验从临时目录读取的发布锁元数据
 *
 * @remarks
 * 锁文件可能被其他进程截断或替换，只有完整结构和预期工作目录才可用于进程存活判断
 *
 * @internal
 */
function isLockMetadata(
  value: unknown,
  expectedCwd: string,
): value is LockMetadata {
  if (!value || typeof value !== 'object') {
    return false
  }

  const metadata = value as Partial<LockMetadata>
  return (
    metadata.cwd === expectedCwd &&
    typeof metadata.createdAt === 'string' &&
    Number.isFinite(Date.parse(metadata.createdAt)) &&
    typeof metadata.pid === 'number' &&
    Number.isInteger(metadata.pid) &&
    metadata.pid > 0 &&
    typeof metadata.token === 'string' &&
    metadata.token.length > 0
  )
}

/** 持有互斥后仅回收超过三十秒保护窗口的不完整锁，保留刚创建的锁文件 */
async function removeInvalidLockIfStale(lockPath: string): Promise<boolean> {
  let lockStat: Awaited<ReturnType<typeof stat>>

  try {
    lockStat = await stat(lockPath)
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT'
  }

  if (Date.now() - lockStat.mtimeMs > staleInvalidLockMs) {
    await unlink(lockPath).catch(() => undefined)
    return true
  }

  return false
}

/** 仅在操作系统明确报告进程不存在时允许恢复，权限或其他检查错误均保留锁 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}
