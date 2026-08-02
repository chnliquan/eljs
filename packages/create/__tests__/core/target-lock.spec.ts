import { pathExists } from '@eljs/utils/file'
import { randomUUID } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
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
      details: { ownerPid: process.pid, targetDir: lock.metadata.targetDir },
    })

    await releaseTargetLock(lock)
    await expect(pathExists(lock.path)).resolves.toBe(false)
  })

  it('同一物理目标的符号链接别名共用一把锁', async () => {
    const targetDir = await createWorkspace(true)
    const targetAlias = path.join(cwd, 'project-alias')
    await symlink(
      targetDir,
      targetAlias,
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    const lock = await acquireTargetLock(cwd, targetDir)

    await expect(acquireTargetLock(cwd, targetAlias)).rejects.toMatchObject({
      code: 'CREATE_TARGET_LOCKED',
      details: { ownerPid: process.pid, targetDir: lock.metadata.targetDir },
    })

    await releaseTargetLock(lock)
  })

  it('应该通过工作目录别名恢复同一物理位置的遗留备份', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-target-lock-alias-'))
    const workspaceRoot = path.join(cwd, 'workspace')
    const workspaceAlias = path.join(cwd, 'workspace-alias')
    const targetDir = path.join(workspaceRoot, 'project')
    const targetAlias = path.join(workspaceAlias, 'project')
    await mkdir(targetDir, { recursive: true })
    await writeFile(path.join(targetDir, 'original.txt'), 'original\n')
    await symlink(
      workspaceRoot,
      workspaceAlias,
      process.platform === 'win32' ? 'junction' : 'dir',
    )

    const lock = await acquireTargetLock(workspaceAlias, targetAlias)
    const backupAlias = path.join(
      workspaceAlias,
      `.eljs-backup-${randomUUID()}`,
    )
    await updateTargetLockBackup(lock, backupAlias)
    await rename(targetAlias, backupAlias)
    await mkdir(targetAlias)
    await markOwnerDead(lock.path)

    const recoveredLock = await acquireTargetLock(workspaceRoot, targetDir)

    await expect(
      readFile(path.join(targetDir, 'original.txt'), 'utf8'),
    ).resolves.toBe('original\n')
    await releaseTargetLock(recoveredLock)
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
    await expect(pathExists(path.join(targetDir, 'partial.txt'))).resolves.toBe(
      false,
    )
    await expect(pathExists(backupPath)).resolves.toBe(false)
    await releaseTargetLock(recoveredLock)
  })

  it('进程异常退出后删除新目标中的半成品', async () => {
    const targetDir = await createWorkspace()
    const lock = await acquireTargetLock(cwd, targetDir)
    await mkdir(targetDir)
    await writeFile(path.join(targetDir, 'partial.txt'), 'partial\n')
    await markOwnerDead(lock.path)

    const recoveredLock = await acquireTargetLock(cwd, targetDir)

    await expect(pathExists(targetDir)).resolves.toBe(false)
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
    await expect(pathExists(targetDir)).resolves.toBe(true)
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

  it('更新备份路径时拒绝覆盖所有者已变化的锁', async () => {
    const targetDir = await createWorkspace()
    const lock = await acquireTargetLock(cwd, targetDir)
    const metadata = JSON.parse(await readFile(lock.path, 'utf8')) as {
      backupPath?: string
      ownerId: string
    }
    metadata.ownerId = 'another-owner'
    await writeFile(lock.path, JSON.stringify(metadata))

    await expect(
      updateTargetLockBackup(lock, path.join(cwd, 'backup')),
    ).rejects.toMatchObject({
      code: 'CREATE_TARGET_LOCKED',
    })
    await expect(readFile(lock.path, 'utf8')).resolves.toBe(
      JSON.stringify(metadata),
    )
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
