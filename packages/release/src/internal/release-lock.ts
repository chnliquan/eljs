import { createHash, randomUUID } from 'node:crypto'
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  stat,
  unlink,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

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
 * 当前工作目录的跨进程发布锁
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
   * 当另一个存活进程正在发布相同工作目录时抛出
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
   */
  public async release(): Promise<void> {
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
    }
  }
}

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

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}
