import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import {
  mkdir,
  mkdtemp,
  rm,
  stat,
  symlink,
  unlink,
  utimes,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { ReleaseLock } from '../../src/internal/release-lock'

describe('release 跨进程锁', () => {
  let cwd: string | undefined
  let lock: ReleaseLock | undefined
  let lockPath: string | undefined

  afterEach(async () => {
    await lock?.release()
    if (lockPath) {
      await unlink(lockPath).catch(() => undefined)
    }
    if (cwd) {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('应该阻止同一工作目录同时运行两个发布流程', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-lock-test-'))
    lock = await ReleaseLock.acquire(cwd)

    await expect(ReleaseLock.acquire(cwd)).rejects.toThrow(
      'Another release process is already running',
    )
  })

  it('释放后应该允许新的发布流程获取锁', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-lock-test-'))
    lock = await ReleaseLock.acquire(cwd)
    await lock.release()

    lock = await ReleaseLock.acquire(cwd)

    expect(lock).toBeInstanceOf(ReleaseLock)
  })

  it('应该自动清理已经退出进程留下的锁', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-lock-test-'))
    lockPath = getLockPath(cwd)
    await mkdir(path.dirname(lockPath), { recursive: true })
    await writeFile(
      lockPath,
      JSON.stringify({
        cwd: realpathSync(cwd),
        createdAt: new Date().toISOString(),
        pid: 2_147_483_647,
        token: 'stale-owner',
      }),
    )

    lock = await ReleaseLock.acquire(cwd)

    expect(lock).toBeInstanceOf(ReleaseLock)
  })

  it('应该清理超过保护窗口的损坏锁', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-lock-test-'))
    lockPath = getLockPath(cwd)
    await mkdir(path.dirname(lockPath), { recursive: true })
    await writeFile(lockPath, JSON.stringify({ pid: process.pid }))
    const staleTime = new Date(Date.now() - 60_000)
    await utimes(lockPath, staleTime, staleTime)

    lock = await ReleaseLock.acquire(cwd)

    expect(lock).toBeInstanceOf(ReleaseLock)
  })

  it.runIf(process.platform !== 'win32')(
    '应该限制锁目录和文件权限',
    async () => {
      cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-lock-test-'))
      lockPath = getLockPath(cwd)

      lock = await ReleaseLock.acquire(cwd)

      expect((await stat(path.dirname(lockPath))).mode & 0o777).toBe(0o700)
      expect((await stat(lockPath)).mode & 0o777).toBe(0o600)
    },
  )

  it('符号链接和真实工作目录应该竞争同一把锁', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-lock-test-'))
    const aliasPath = path.join(cwd, 'workspace-alias')
    await symlink(
      cwd,
      aliasPath,
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    lock = await ReleaseLock.acquire(cwd)

    await expect(ReleaseLock.acquire(aliasPath)).rejects.toThrow(
      'Another release process is already running',
    )
  })

  it('新近生成的损坏锁不应该被其他进程立即删除', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-lock-test-'))
    lockPath = getLockPath(cwd)
    await mkdir(path.dirname(lockPath), { recursive: true })
    await writeFile(lockPath, '{invalid-json')

    await expect(ReleaseLock.acquire(cwd)).rejects.toThrow(
      'Another release process is already running',
    )
  })

  it('释放时不应该删除所有权令牌已经变化的锁', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-lock-test-'))
    lockPath = getLockPath(cwd)
    lock = await ReleaseLock.acquire(cwd)
    await writeFile(
      lockPath,
      JSON.stringify({
        cwd: realpathSync(cwd),
        createdAt: new Date().toISOString(),
        pid: process.pid,
        token: 'replacement-owner',
      }),
    )

    await lock.release()

    await expect(stat(lockPath)).resolves.toBeDefined()
  })

  it('锁文件已经不存在时重复释放应该保持幂等', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-lock-test-'))
    lockPath = getLockPath(cwd)
    lock = await ReleaseLock.acquire(cwd)
    await unlink(lockPath)

    await expect(lock.release()).resolves.toBeUndefined()
  })
})

function getLockPath(cwd: string): string {
  const userNamespace =
    typeof process.getuid === 'function' ? process.getuid() : 'default'
  const lockName = `${createHash('sha256')
    .update(realpathSync(cwd))
    .digest('hex')}.json`
  return path.join(tmpdir(), `eljs-release-locks-${userNamespace}`, lockName)
}
