import { isPathExists } from '@eljs/utils/file'
import { randomUUID } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  acquireTargetLock,
  releaseTargetLock,
  updateTargetLockBackup,
} from '../../src/core/target-lock'

describe('目标目录锁', () => {
  let cwd = ''

  afterEach(async () => {
    vi.restoreAllMocks()
    if (cwd) {
      await rm(cwd, { recursive: true, force: true })
      cwd = ''
    }
  })

  it('同一目标只能被一个创建流程持有', async () => {
    const targetDir = await createWorkspace()
    const lock = await acquireTargetLock(cwd, targetDir)

    await expect(acquireTargetLock(cwd, targetDir)).rejects.toMatchObject({
      code: 'CREATE_TARGET_LOCKED',
      details: { ownerPid: process.pid, targetDir },
    })

    await releaseTargetLock(lock)
    await expect(isPathExists(lock.path)).resolves.toBe(false)
  })

  it('进程异常退出后恢复原目标备份', async () => {
    const targetDir = await createWorkspace(true)
    const originalFile = path.join(targetDir, 'original.txt')
    await writeFile(originalFile, 'original\n')
    const lock = await acquireTargetLock(cwd, targetDir)
    const backupPath = path.join(cwd, `.eljs-backup-${randomUUID()}`)
    await updateTargetLockBackup(lock, backupPath)
    await rename(targetDir, backupPath)
    await mkdir(targetDir)
    await writeFile(path.join(targetDir, 'partial.txt'), 'partial\n')
    await markOwnerDead(lock.path)

    const recoveredLock = await acquireTargetLock(cwd, targetDir)

    await expect(readFile(originalFile, 'utf8')).resolves.toBe('original\n')
    await expect(
      isPathExists(path.join(targetDir, 'partial.txt')),
    ).resolves.toBe(false)
    await expect(isPathExists(backupPath)).resolves.toBe(false)
    await releaseTargetLock(recoveredLock)
  })

  it('进程异常退出后删除新目标中的半成品', async () => {
    const targetDir = await createWorkspace()
    const lock = await acquireTargetLock(cwd, targetDir)
    await mkdir(targetDir)
    await writeFile(path.join(targetDir, 'partial.txt'), 'partial\n')
    await markOwnerDead(lock.path)

    const recoveredLock = await acquireTargetLock(cwd, targetDir)

    await expect(isPathExists(targetDir)).resolves.toBe(false)
    await releaseTargetLock(recoveredLock)
  })

  it('拒绝遗留锁中的越界备份路径', async () => {
    const targetDir = await createWorkspace(true)
    const lock = await acquireTargetLock(cwd, targetDir)
    await updateTargetLockBackup(lock, path.join(tmpdir(), 'outside-backup'))
    await markOwnerDead(lock.path)

    await expect(acquireTargetLock(cwd, targetDir)).rejects.toMatchObject({
      code: 'CREATE_RECOVERY_FAILED',
    })
    await expect(isPathExists(targetDir)).resolves.toBe(true)
  })

  it('拒绝无法解析的锁文件', async () => {
    const targetDir = await createWorkspace()
    const lock = await acquireTargetLock(cwd, targetDir)
    await writeFile(lock.path, 'invalid json')

    await expect(acquireTargetLock(cwd, targetDir)).rejects.toMatchObject({
      code: 'CREATE_TARGET_LOCKED',
    })
  })

  it('把其他主机持有的锁视为活跃锁', async () => {
    const targetDir = await createWorkspace()
    const lock = await acquireTargetLock(cwd, targetDir)
    const metadata = JSON.parse(await readFile(lock.path, 'utf8')) as {
      hostname: string
    }
    metadata.hostname = 'another-host'
    await writeFile(lock.path, JSON.stringify(metadata))

    await expect(acquireTargetLock(cwd, targetDir)).rejects.toMatchObject({
      code: 'CREATE_TARGET_LOCKED',
    })
  })

  it('原目标和备份都丢失时拒绝继续', async () => {
    const targetDir = await createWorkspace(true)
    const lock = await acquireTargetLock(cwd, targetDir)
    await rm(targetDir, { recursive: true })
    await markOwnerDead(lock.path)

    await expect(acquireTargetLock(cwd, targetDir)).rejects.toMatchObject({
      code: 'CREATE_RECOVERY_FAILED',
    })
  })

  it('释放时拒绝删除所有者已变化的锁', async () => {
    const targetDir = await createWorkspace()
    const lock = await acquireTargetLock(cwd, targetDir)
    const metadata = JSON.parse(await readFile(lock.path, 'utf8')) as {
      ownerId: string
    }
    metadata.ownerId = 'another-owner'
    await writeFile(lock.path, JSON.stringify(metadata))

    await expect(releaseTargetLock(lock)).rejects.toMatchObject({
      code: 'CREATE_TARGET_LOCKED',
    })
  })

  async function createWorkspace(targetExists = false): Promise<string> {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-target-lock-'))
    const targetDir = path.join(cwd, 'project')
    if (targetExists) {
      await mkdir(targetDir)
    }
    return targetDir
  }

  async function markOwnerDead(lockPath: string): Promise<void> {
    const metadata = JSON.parse(await readFile(lockPath, 'utf8')) as {
      pid: number
    }
    metadata.pid = 2_147_483_647
    await writeFile(lockPath, JSON.stringify(metadata))
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('No such process'), { code: 'ESRCH' })
    })
  }
})
