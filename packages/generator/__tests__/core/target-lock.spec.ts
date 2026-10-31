import { pathExists } from '@eljs/utils/file'
import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import * as fsPromises from 'node:fs/promises'
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { hostname, tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  acquireTargetLock,
  commitTargetLock,
  releaseTargetLock,
  updateTargetLockBackup,
} from '../../src/core/target-lock'

vi.mock('node:fs/promises', async importOriginal => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
}))

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

  it.each([false, true])(
    '锁已发布但 mutex 释放失败时保留原错误并允许同进程重试（原目标存在：%s）',
    async targetExisted => {
      const targetDir = await createWorkspace(targetExisted)
      if (targetExisted) {
        await writeFile(path.join(targetDir, 'original.txt'), 'original\n')
      }
      const failure = Object.assign(new Error('mutex release denied'), {
        code: 'EACCES',
      })
      const realRename = fsPromises.rename
      const renameSpy = vi
        .spyOn(fsPromises, 'rename')
        .mockImplementation(async (from, to) => {
          if (String(from).endsWith('.lock.acquire')) {
            throw failure
          }
          return realRename(from, to)
        })

      await expect(acquireTargetLock(cwd, targetDir)).rejects.toBe(failure)
      const names = await readdir(cwd)
      const lockName = names.find(name => name.endsWith('.lock'))
      expect(lockName).toBeDefined()
      const lockPath = path.join(cwd, lockName as string)
      expect(JSON.parse(await readFile(lockPath, 'utf8'))).toMatchObject({
        phase: 'recovery-pending',
        recoveryPhase: 'active',
        targetExisted,
        pid: process.pid,
      })
      expect(
        JSON.parse(
          await readFile(
            path.join(`${lockPath}.acquire`, 'owner.json'),
            'utf8',
          ),
        ),
      ).toMatchObject({ phase: 'recovery-pending', pid: process.pid })

      await expect(acquireTargetLock(cwd, targetDir)).rejects.toBe(failure)
      renameSpy.mockRestore()
      const recovered = await acquireTargetLock(cwd, targetDir)
      if (targetExisted) {
        await expect(
          readFile(path.join(targetDir, 'original.txt'), 'utf8'),
        ).resolves.toBe('original\n')
      } else {
        await expect(pathExists(targetDir)).resolves.toBe(false)
      }
      await releaseTargetLock(recovered)
    },
  )

  it('初始发布错误不被 mutex 释放错误覆盖，撤销故障后可重试', async () => {
    const targetDir = await createWorkspace()
    const original = new Error('initial publication failed')
    const releaseError = Object.assign(new Error('mutex release denied'), {
      code: 'EACCES',
    })
    const realRename = fsPromises.rename
    const renameSpy = vi
      .spyOn(fsPromises, 'rename')
      .mockImplementation(async (from, to) => {
        if (String(to).endsWith('.lock')) {
          throw original
        }
        if (String(from).endsWith('.lock.acquire')) {
          throw releaseError
        }
        return realRename(from, to)
      })
    await expect(acquireTargetLock(cwd, targetDir)).rejects.toBe(original)
    expect((await readdir(cwd)).some(name => name.endsWith('.lock'))).toBe(
      false,
    )
    renameSpy.mockRestore()
    const recovered = await acquireTargetLock(cwd, targetDir)
    await releaseTargetLock(recovered)
  })

  it('单次 mutex 释放故障交接期间竞争者不能提前接管目标', async () => {
    const targetDir = await createWorkspace()
    const failure = Object.assign(new Error('mutex release denied once'), {
      code: 'EACCES',
    })
    const realRename = fsPromises.rename
    let lockPath = ''
    let failed = false
    let resume: () => void = () => undefined
    let entered: () => void = () => undefined
    const paused = new Promise<void>(resolve => {
      entered = resolve
    })
    const gate = new Promise<void>(resolve => {
      resume = resolve
    })
    vi.spyOn(fsPromises, 'rename').mockImplementation(async (from, to) => {
      if (String(from).endsWith('.lock.acquire') && !failed) {
        failed = true
        throw failure
      }
      if (String(to).endsWith('.lock')) {
        lockPath = String(to)
        if (failed) {
          entered()
          await gate
        }
      }
      return realRename(from, to)
    })
    const acquiring = acquireTargetLock(cwd, targetDir)
    const rejection = expect(acquiring).rejects.toBe(failure)
    await paused
    try {
      expect(JSON.parse(await readFile(lockPath, 'utf8')).phase).toBe('active')
      await expect(acquireTargetLock(cwd, targetDir)).rejects.toMatchObject({
        code: 'CREATE_TARGET_LOCKED',
      })
      expect(
        JSON.parse(
          await readFile(
            path.join(`${lockPath}.acquire`, 'owner.json'),
            'utf8',
          ),
        ).phase,
      ).toBeUndefined()
    } finally {
      resume()
      await rejection
    }
    const recovered = await acquireTargetLock(cwd, targetDir)
    await releaseTargetLock(recovered)
  })

  it.each(['active', 'committing'] as const)(
    '恢复交接后 mutex 释放失败仍保留 %s 方向和备份供同进程重试',
    async phase => {
      const targetDir = await createWorkspace(true)
      await writeFile(path.join(targetDir, 'original.txt'), 'original\n')
      const lock = await acquireTargetLock(cwd, targetDir)
      const backupPath = path.join(cwd, `.eljs-backup-${randomUUID()}`)
      await updateTargetLockBackup(lock, backupPath)
      await rename(targetDir, backupPath)
      await mkdir(targetDir)
      await writeFile(path.join(targetDir, 'new.txt'), 'new\n')
      if (phase === 'committing') {
        await commitTargetLock(lock)
      }
      lock.recoveryRequired = true
      const failure = Object.assign(new Error('mutex release denied'), {
        code: 'EACCES',
      })
      const realRename = fsPromises.rename
      const renameSpy = vi
        .spyOn(fsPromises, 'rename')
        .mockImplementation(async (from, to) => {
          if (from === `${lock.path}.acquire`) {
            throw failure
          }
          return realRename(from, to)
        })
      await expect(releaseTargetLock(lock)).rejects.toBe(failure)
      expect(JSON.parse(await readFile(lock.path, 'utf8'))).toMatchObject({
        phase: 'recovery-pending',
        recoveryPhase: phase,
        backupPath,
      })
      await expect(pathExists(backupPath)).resolves.toBe(true)
      renameSpy.mockRestore()
      const recovered = await acquireTargetLock(cwd, targetDir)
      await expect(
        readFile(
          path.join(targetDir, phase === 'active' ? 'original.txt' : 'new.txt'),
          'utf8',
        ),
      ).resolves.toBe(phase === 'active' ? 'original\n' : 'new\n')
      await expect(pathExists(backupPath)).resolves.toBe(false)
      await releaseTargetLock(recovered)
    },
  )

  it('释放失败后不能交接所有权已变化的 mutex', async () => {
    const targetDir = await createWorkspace()
    const lock = await acquireTargetLock(cwd, targetDir)
    const failure = Object.assign(new Error('mutex release denied'), {
      code: 'EACCES',
    })
    const realRename = fsPromises.rename
    let replacement = ''
    vi.spyOn(fsPromises, 'rename').mockImplementation(async (from, to) => {
      if (from === `${lock.path}.acquire`) {
        const ownerPath = path.join(String(from), 'owner.json')
        const owner = JSON.parse(await readFile(ownerPath, 'utf8'))
        replacement = JSON.stringify({ ...owner, ownerId: 'unknown-owner' })
        await writeFile(ownerPath, replacement)
        throw failure
      }
      return realRename(from, to)
    })
    await expect(releaseTargetLock(lock)).rejects.toBe(failure)
    await expect(
      readFile(path.join(`${lock.path}.acquire`, 'owner.json'), 'utf8'),
    ).resolves.toBe(replacement)
    await expect(acquireTargetLock(cwd, targetDir)).rejects.toMatchObject({
      code: 'CREATE_TARGET_LOCKED',
    })
  })

  it('目标锁交接无法持久化时保留记录且不提前交接 mutex', async () => {
    const targetDir = await createWorkspace()
    const failure = Object.assign(new Error('mutex release denied'), {
      code: 'EACCES',
    })
    const realRename = fsPromises.rename
    let publishedPath = ''
    vi.spyOn(fsPromises, 'rename').mockImplementation(async (from, to) => {
      if (String(from).endsWith('.lock.acquire')) {
        throw failure
      }
      if (String(to).endsWith('.lock')) {
        if (publishedPath) {
          throw new Error('handoff publication denied')
        }
        publishedPath = String(to)
      }
      return realRename(from, to)
    })
    await expect(acquireTargetLock(cwd, targetDir)).rejects.toBe(failure)
    expect(JSON.parse(await readFile(publishedPath, 'utf8'))).toMatchObject({
      phase: 'active',
      targetExisted: false,
    })
    expect(
      JSON.parse(
        await readFile(
          path.join(`${publishedPath}.acquire`, 'owner.json'),
          'utf8',
        ),
      ).phase,
    ).toBeUndefined()
    vi.restoreAllMocks()
    await expect(acquireTargetLock(cwd, targetDir)).rejects.toMatchObject({
      code: 'CREATE_TARGET_LOCKED',
    })
    await markOwnerDead(publishedPath)
    await markOwnerDead(path.join(`${publishedPath}.acquire`, 'owner.json'))
    const recovered = await acquireTargetLock(cwd, targetDir)
    await releaseTargetLock(recovered)
  })

  it.each(['writing', 'published'])(
    '初始锁在 %s 时真实进程退出后仍可重新获取',
    async phase => {
      const targetDir = await createWorkspace(true)
      await writeFile(path.join(targetDir, 'original.txt'), 'original\n')
      const moduleUrl = new URL(
        '../../src/core/target-lock.ts',
        import.meta.url,
      ).href
      await expect(
        promisify(execFile)(process.execPath, [
          '--import',
          'tsx',
          '--input-type=module',
          '-e',
          `import fs from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
const [cwd, target, phase] = process.argv.slice(1)
const originalOpen = fs.open
const originalRename = fs.rename
fs.open = async (...args) => {
  const handle = await originalOpen(...args)
  if (phase === 'writing' && String(args[0]).endsWith('.tmp')) {
    const originalWrite = handle.writeFile.bind(handle)
    handle.writeFile = async data => {
      await originalWrite(String(data).slice(0, 8))
      process.exit(75)
    }
  }
  return handle
}
fs.rename = async (from, to) => {
  await originalRename(from, to)
  if (phase === 'published' && String(to).endsWith('.lock')) process.exit(75)
}
syncBuiltinESMExports()
const { acquireTargetLock } = await import(${JSON.stringify(moduleUrl)})
await acquireTargetLock(cwd, target)
throw new Error('Expected interruption point was not reached')
`,
          cwd,
          targetDir,
          phase,
        ]),
      ).rejects.toMatchObject({ code: 75 })

      const names = await readdir(cwd)
      const publicLocks = names.filter(name => name.endsWith('.lock'))
      if (phase === 'writing') {
        expect(publicLocks).toEqual([])
        expect(names.some(name => name.endsWith('.tmp'))).toBe(true)
      } else {
        expect(publicLocks).toHaveLength(1)
        expect(
          JSON.parse(await readFile(path.join(cwd, publicLocks[0]), 'utf8')),
        ).toMatchObject({ version: 2, phase: 'active', targetExisted: true })
      }
      const recovered = await acquireTargetLock(cwd, targetDir)
      await expect(
        readFile(path.join(targetDir, 'original.txt'), 'utf8'),
      ).resolves.toBe('original\n')
      await releaseTargetLock(recovered)
    },
  )

  it('恢复删除半成品后真实退出仍保留记录中的备份供下次恢复', async () => {
    const targetDir = await createWorkspace(true)
    await writeFile(path.join(targetDir, 'original.txt'), 'original\n')
    const moduleUrl = new URL('../../src/core/target-lock.ts', import.meta.url)
      .href
    await expect(
      promisify(execFile)(process.execPath, [
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        `import fs from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
const { acquireTargetLock, updateTargetLockBackup } = await import(${JSON.stringify(moduleUrl)})
const [cwd, rawTarget] = process.argv.slice(1)
const lock = await acquireTargetLock(cwd, rawTarget)
const target = lock.metadata.targetDir
const backup = path.join(lock.cwd, '.eljs-backup-' + randomUUID())
await updateTargetLockBackup(lock, backup)
await fs.rename(target, backup)
await fs.mkdir(target)
await fs.writeFile(path.join(target, 'partial.txt'), 'partial')
const metadata = JSON.parse(await fs.readFile(lock.path, 'utf8'))
metadata.pid = 2147483647
await fs.writeFile(lock.path, JSON.stringify(metadata))
const originalRename = fs.rename
fs.rename = async (from, to) => {
  if (String(from) === backup && String(to) === target) process.exit(75)
  return originalRename(from, to)
}
syncBuiltinESMExports()
await acquireTargetLock(cwd, target)
throw new Error('Expected interruption point was not reached')
`,
        cwd,
        targetDir,
      ]),
    ).rejects.toMatchObject({ code: 75, stderr: '' })
    await expect(pathExists(targetDir)).resolves.toBe(false)
    const lockFile = (await readdir(cwd)).find(name => name.endsWith('.lock'))
    if (!lockFile) {
      throw new Error('Missing recovery lock')
    }
    const metadata = JSON.parse(
      await readFile(path.join(cwd, lockFile), 'utf8'),
    )
    await expect(
      readFile(path.join(metadata.backupPath, 'original.txt'), 'utf8'),
    ).resolves.toBe('original\n')

    const recovered = await acquireTargetLock(cwd, targetDir)
    await expect(
      readFile(path.join(targetDir, 'original.txt'), 'utf8'),
    ).resolves.toBe('original\n')
    expect(
      (await readdir(cwd)).some(name => name.startsWith('.eljs-move-')),
    ).toBe(false)
    await releaseTargetLock(recovered)
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

  it('嵌套 cwd 与祖先 cwd 对同一目标共用锁且不依赖获取顺序', async () => {
    await createWorkspace()
    const nestedCwd = path.join(cwd, 'nested')
    const targetDir = path.join(nestedCwd, 'project')
    await mkdir(nestedCwd)
    for (const [firstCwd, secondCwd] of [
      [cwd, nestedCwd],
      [nestedCwd, cwd],
    ]) {
      const lock = await acquireTargetLock(firstCwd, targetDir)
      expect(path.dirname(lock.path)).toBe(
        path.dirname(lock.metadata.targetDir),
      )
      await expect(
        acquireTargetLock(secondCwd, targetDir),
      ).rejects.toMatchObject({
        code: 'CREATE_TARGET_LOCKED',
      })
      await releaseTargetLock(lock)
    }
  })

  it('获取尚不存在的多层目标时先创建父目录', async () => {
    await createWorkspace()
    const targetDir = path.join(cwd, 'one', 'two', 'project')
    const lock = await acquireTargetLock(cwd, targetDir)
    await expect(pathExists(path.dirname(targetDir))).resolves.toBe(true)
    await expect(pathExists(targetDir)).resolves.toBe(false)
    await releaseTargetLock(lock)
  })

  it.each(['ancestor', 'nested'])(
    '从另一个 %s cwd 恢复时按原 cwd 验证备份',
    async direction => {
      await createWorkspace()
      const nestedCwd = path.join(cwd, 'nested')
      const targetDir = path.join(nestedCwd, 'project')
      await mkdir(targetDir, { recursive: true })
      await writeFile(path.join(targetDir, 'original.txt'), 'original\n')
      const originalCwd = direction === 'ancestor' ? nestedCwd : cwd
      const recoveryCwd = direction === 'ancestor' ? cwd : nestedCwd
      const lock = await acquireTargetLock(originalCwd, targetDir)
      const backupPath = path.join(originalCwd, `.eljs-backup-${randomUUID()}`)
      await updateTargetLockBackup(lock, backupPath)
      await rename(targetDir, backupPath)
      await mkdir(targetDir)
      await markOwnerDead(lock.path)

      const recovered = await acquireTargetLock(recoveryCwd, targetDir)
      await expect(
        readFile(path.join(targetDir, 'original.txt'), 'utf8'),
      ).resolves.toBe('original\n')
      expect(recovered.metadata.cwd).toBe(recovered.cwd)
      await releaseTargetLock(recovered)
    },
  )

  it('真实子进程退出后从另一祖先 cwd 恢复原 cwd 的备份', async () => {
    await createWorkspace()
    const nestedCwd = path.join(cwd, 'nested')
    const targetDir = path.join(nestedCwd, 'project')
    await mkdir(targetDir, { recursive: true })
    await writeFile(path.join(targetDir, 'original.txt'), 'original\n')
    const moduleUrl = new URL('../../src/core/target-lock.ts', import.meta.url)
      .href
    await promisify(execFile)(process.execPath, [
      '--import',
      'tsx',
      '--input-type=module',
      '-e',
      `import { acquireTargetLock, updateTargetLockBackup } from ${JSON.stringify(moduleUrl)}
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
const [cwd, target] = process.argv.slice(1)
const lock = await acquireTargetLock(cwd, target)
const backup = path.join(lock.cwd, '.eljs-backup-' + randomUUID())
await updateTargetLockBackup(lock, backup)
await rename(target, backup)
await mkdir(target)
await writeFile(path.join(target, 'partial.txt'), 'partial')
`,
      cwd,
      targetDir,
    ])
    const recovered = await acquireTargetLock(nestedCwd, targetDir)
    await expect(
      readFile(path.join(targetDir, 'original.txt'), 'utf8'),
    ).resolves.toBe('original\n')
    await expect(pathExists(path.join(targetDir, 'partial.txt'))).resolves.toBe(
      false,
    )
    await releaseTargetLock(recovered)
  })

  it('原 PID 仍存活时另一进程可接管已交接的 pending', async () => {
    const targetDir = await createWorkspace(true)
    await writeFile(path.join(targetDir, 'original.txt'), 'original\n')
    const lock = await acquireTargetLock(cwd, targetDir)
    const backupPath = path.join(lock.cwd, `.eljs-backup-${randomUUID()}`)
    await updateTargetLockBackup(lock, backupPath)
    await rename(targetDir, backupPath)
    await mkdir(targetDir)
    lock.recoveryRequired = true
    await releaseTargetLock(lock)
    const moduleUrl = new URL('../../src/core/target-lock.ts', import.meta.url)
      .href
    await promisify(execFile)(process.execPath, [
      '--import',
      'tsx',
      '--input-type=module',
      '-e',
      `import { acquireTargetLock, releaseTargetLock } from ${JSON.stringify(moduleUrl)}
const [cwd, target] = process.argv.slice(1)
const lock = await acquireTargetLock(cwd, target)
await releaseTargetLock(lock)
`,
      cwd,
      targetDir,
    ])
    await expect(
      readFile(path.join(targetDir, 'original.txt'), 'utf8'),
    ).resolves.toBe('original\n')
    await expect(pathExists(lock.path)).resolves.toBe(false)
  })

  it('原 cwd 被篡改为非目标祖先时保留备份并拒绝恢复', async () => {
    const targetDir = await createWorkspace(true)
    const lock = await acquireTargetLock(cwd, targetDir)
    const outside = path.join(cwd, 'outside')
    await mkdir(outside)
    const backupPath = path.join(outside, `.eljs-backup-${randomUUID()}`)
    await updateTargetLockBackup(lock, backupPath)
    await rename(targetDir, backupPath)
    await markOwnerDead(lock.path)
    const metadata = JSON.parse(await readFile(lock.path, 'utf8'))
    metadata.cwd = await fsPromises.realpath(outside)
    await writeFile(lock.path, JSON.stringify(metadata))

    await expect(acquireTargetLock(cwd, targetDir)).rejects.toMatchObject({
      code: 'CREATE_RECOVERY_FAILED',
    })
    await expect(pathExists(backupPath)).resolves.toBe(true)
    await expect(pathExists(lock.path)).resolves.toBe(true)
  })

  it('提交中断后只清理残缺备份并保留新目标', async () => {
    const targetDir = await createWorkspace(true)
    await writeFile(path.join(targetDir, 'original.txt'), 'original\n')
    await writeFile(path.join(targetDir, 'remaining.txt'), 'remaining\n')
    const lock = await acquireTargetLock(cwd, targetDir)
    const backupPath = path.join(cwd, `.eljs-backup-${randomUUID()}`)
    await updateTargetLockBackup(lock, backupPath)
    await rename(targetDir, backupPath)
    await mkdir(targetDir)
    await writeFile(path.join(targetDir, 'new.txt'), 'new\n')
    await commitTargetLock(lock)
    await rm(path.join(backupPath, 'original.txt'))
    await markOwnerDead(lock.path)

    const recovered = await acquireTargetLock(cwd, targetDir)
    await expect(
      readFile(path.join(targetDir, 'new.txt'), 'utf8'),
    ).resolves.toBe('new\n')
    await expect(
      pathExists(path.join(targetDir, 'remaining.txt')),
    ).resolves.toBe(false)
    await expect(pathExists(backupPath)).resolves.toBe(false)
    await releaseTargetLock(recovered)
  })

  it('提交阶段新目标丢失时不还原备份并保留记录', async () => {
    const targetDir = await createWorkspace(true)
    const lock = await acquireTargetLock(cwd, targetDir)
    const backupPath = path.join(cwd, `.eljs-backup-${randomUUID()}`)
    await updateTargetLockBackup(lock, backupPath)
    await rename(targetDir, backupPath)
    await commitTargetLock(lock)
    await markOwnerDead(lock.path)

    await expect(acquireTargetLock(cwd, targetDir)).rejects.toMatchObject({
      code: 'CREATE_RECOVERY_FAILED',
    })
    await expect(pathExists(backupPath)).resolves.toBe(true)
    await expect(pathExists(targetDir)).resolves.toBe(false)
    await expect(pathExists(lock.path)).resolves.toBe(true)
  })

  it.each([false, true])(
    '备份已删除或从未存在时提交恢复仍保留新目标（原目标存在：%s）',
    async targetExisted => {
      const targetDir = await createWorkspace(targetExisted)
      const lock = await acquireTargetLock(cwd, targetDir)
      if (!targetExisted) {
        await mkdir(targetDir)
      }
      await writeFile(path.join(targetDir, 'new.txt'), 'new\n')
      if (targetExisted) {
        await updateTargetLockBackup(
          lock,
          path.join(cwd, `.eljs-backup-${randomUUID()}`),
        )
      }
      await commitTargetLock(lock)
      await markOwnerDead(lock.path)
      const recovered = await acquireTargetLock(cwd, targetDir)
      await expect(
        readFile(path.join(targetDir, 'new.txt'), 'utf8'),
      ).resolves.toBe('new\n')
      await releaseTargetLock(recovered)
    },
  )

  it.each(['active', 'committing'] as const)(
    '活跃 PID 的 pending 可按 %s 方向恢复且旧所有者不能再更新',
    async phase => {
      const targetDir = await createWorkspace(true)
      await writeFile(path.join(targetDir, 'original.txt'), 'original\n')
      const lock = await acquireTargetLock(cwd, targetDir)
      const backupPath = path.join(cwd, `.eljs-backup-${randomUUID()}`)
      await updateTargetLockBackup(lock, backupPath)
      await rename(targetDir, backupPath)
      await mkdir(targetDir)
      await writeFile(path.join(targetDir, 'new.txt'), 'new\n')
      if (phase === 'committing') {
        await commitTargetLock(lock)
      }
      lock.recoveryRequired = true
      await releaseTargetLock(lock)
      expect(JSON.parse(await readFile(lock.path, 'utf8'))).toMatchObject({
        phase: 'recovery-pending',
        recoveryPhase: phase,
        pid: process.pid,
        backupPath,
      })
      await expect(
        updateTargetLockBackup(lock, undefined),
      ).rejects.toMatchObject({ code: 'CREATE_TARGET_LOCKED' })
      await expect(releaseTargetLock(lock)).rejects.toMatchObject({
        code: 'CREATE_TARGET_LOCKED',
      })

      const recovered = await acquireTargetLock(cwd, targetDir)
      const retained = phase === 'active' ? 'original.txt' : 'new.txt'
      await expect(pathExists(path.join(targetDir, retained))).resolves.toBe(
        true,
      )
      await expect(releaseTargetLock(lock)).rejects.toMatchObject({
        code: 'CREATE_TARGET_LOCKED',
      })
      await releaseTargetLock(recovered)
    },
  )

  it('pending 发布后必须等原流程释放获取 mutex 才能接管', async () => {
    const targetDir = await createWorkspace()
    const lock = await acquireTargetLock(cwd, targetDir)
    await mkdir(targetDir)
    lock.recoveryRequired = true
    let resume: () => void = () => undefined
    let entered: () => void = () => undefined
    const paused = new Promise<void>(resolve => {
      entered = resolve
    })
    const gate = new Promise<void>(resolve => {
      resume = resolve
    })
    const realRename = fsPromises.rename
    vi.spyOn(fsPromises, 'rename').mockImplementation(async (from, to) => {
      if (from === `${lock.path}.acquire`) {
        entered()
        await gate
      }
      return realRename(from, to)
    })
    const releasing = releaseTargetLock(lock)
    await paused
    try {
      expect(JSON.parse(await readFile(lock.path, 'utf8')).phase).toBe(
        'recovery-pending',
      )
      await expect(acquireTargetLock(cwd, targetDir)).rejects.toMatchObject({
        code: 'CREATE_TARGET_LOCKED',
      })
    } finally {
      resume()
      await releasing
    }
    const results = await Promise.allSettled([
      acquireTargetLock(cwd, targetDir),
      acquireTargetLock(cwd, targetDir),
    ])
    expect(
      results.filter(result => result.status === 'fulfilled'),
    ).toHaveLength(1)
    for (const result of results) {
      if (result.status === 'fulfilled') {
        await releaseTargetLock(result.value)
      } else {
        expect(result.reason).toMatchObject({ code: 'CREATE_TARGET_LOCKED' })
      }
    }
  })

  it('从另一 ancestor cwd 发现并恢复旧 version 1 cwd 位置的锁', async () => {
    await createWorkspace()
    const nestedCwd = path.join(cwd, 'nested')
    const targetDir = path.join(nestedCwd, 'project')
    await mkdir(targetDir, { recursive: true })
    await writeFile(path.join(targetDir, 'original.txt'), 'original\n')
    const lock = await acquireTargetLock(cwd, targetDir)
    const backupPath = path.join(cwd, `.eljs-backup-${randomUUID()}`)
    await updateTargetLockBackup(lock, backupPath)
    await rename(targetDir, backupPath)
    await mkdir(targetDir)
    const legacyPath = await relocateLegacyLock(
      lock.path,
      lock.cwd,
      lock.metadata.targetDir,
    )
    await markOwnerDead(legacyPath)

    const recovered = await acquireTargetLock(nestedCwd, targetDir)
    await expect(
      readFile(path.join(targetDir, 'original.txt'), 'utf8'),
    ).resolves.toBe('original\n')
    await expect(pathExists(legacyPath)).resolves.toBe(false)
    await releaseTargetLock(recovered)
  })

  it('version 1 在新锁位置仍可恢复', async () => {
    const targetDir = await createWorkspace()
    const lock = await acquireTargetLock(cwd, targetDir)
    await relocateLegacyLock(lock.path, lock.cwd, lock.metadata.targetDir)
    await mkdir(targetDir)
    await markOwnerDead(lock.path)
    const recovered = await acquireTargetLock(cwd, targetDir)
    await expect(pathExists(targetDir)).resolves.toBe(false)
    await releaseTargetLock(recovered)
  })

  it('活跃旧锁阻止新位置获取，且不遗失旧记录', async () => {
    await createWorkspace()
    const targetDir = path.join(cwd, 'nested', 'project')
    const lock = await acquireTargetLock(cwd, targetDir)
    const legacyPath = await relocateLegacyLock(
      lock.path,
      lock.cwd,
      lock.metadata.targetDir,
    )
    await expect(
      acquireTargetLock(path.dirname(targetDir), targetDir),
    ).rejects.toMatchObject({ code: 'CREATE_TARGET_LOCKED' })
    await expect(pathExists(legacyPath)).resolves.toBe(true)
    await expect(pathExists(lock.path)).resolves.toBe(false)
  })

  it('旧位置获取 mutex 未完成时不能绕过新位置并发边界', async () => {
    await createWorkspace()
    const targetDir = path.join(cwd, 'nested', 'project')
    const lock = await acquireTargetLock(cwd, targetDir)
    const legacyPath = await relocateLegacyLock(
      lock.path,
      lock.cwd,
      lock.metadata.targetDir,
    )
    await rm(legacyPath)
    await mkdir(`${legacyPath}.acquire`)
    await expect(acquireTargetLock(cwd, targetDir)).rejects.toMatchObject({
      code: 'CREATE_TARGET_LOCKED',
    })
    await expect(pathExists(`${legacyPath}.acquire`)).resolves.toBe(true)
    await expect(pathExists(`${lock.path}.acquire`)).resolves.toBe(false)
  })

  it('新旧恢复记录同时存在时拒绝猜测顺序并保留两份记录', async () => {
    await createWorkspace()
    const targetDir = path.join(cwd, 'nested', 'project')
    const lock = await acquireTargetLock(cwd, targetDir)
    const currentText = await readFile(lock.path, 'utf8')
    const legacyPath = await relocateLegacyLock(
      lock.path,
      lock.cwd,
      lock.metadata.targetDir,
    )
    await writeFile(lock.path, currentText)
    await markOwnerDead(lock.path)
    await markOwnerDead(legacyPath)
    await expect(acquireTargetLock(cwd, targetDir)).rejects.toMatchObject({
      code: 'CREATE_RECOVERY_FAILED',
    })
    await expect(pathExists(lock.path)).resolves.toBe(true)
    await expect(pathExists(legacyPath)).resolves.toBe(true)
  })

  it('新锁活跃时不恢复旁路遗留旧锁', async () => {
    await createWorkspace()
    const targetDir = path.join(cwd, 'nested', 'project')
    const lock = await acquireTargetLock(cwd, targetDir)
    const currentText = await readFile(lock.path, 'utf8')
    const legacyPath = await relocateLegacyLock(
      lock.path,
      lock.cwd,
      lock.metadata.targetDir,
    )
    await markOwnerDead(legacyPath)
    await writeFile(lock.path, currentText)
    const legacyText = await readFile(legacyPath, 'utf8')
    await expect(acquireTargetLock(cwd, targetDir)).rejects.toMatchObject({
      code: 'CREATE_TARGET_LOCKED',
    })
    await expect(readFile(legacyPath, 'utf8')).resolves.toBe(legacyText)
    await releaseTargetLock(lock)
  })

  it('锁路径的权限错误不能被当成锁不存在', async () => {
    const targetDir = await createWorkspace()
    const lock = await acquireTargetLock(cwd, targetDir)
    const originalLstat = fsPromises.lstat
    vi.spyOn(fsPromises, 'lstat').mockImplementation((...args) => {
      if (args[0] === lock.path) {
        return Promise.reject(
          Object.assign(new Error('Denied'), { code: 'EACCES' }),
        )
      }
      return originalLstat(...args)
    })
    await expect(acquireTargetLock(cwd, targetDir)).rejects.toMatchObject({
      code: 'EACCES',
    })
    await expect(pathExists(lock.path)).resolves.toBe(true)
  })

  it('不完整获取 mutex 的 owner 元数据不能被接管', async () => {
    const targetDir = await createWorkspace()
    const lock = await acquireTargetLock(cwd, targetDir)
    await releaseTargetLock(lock)
    await mkdir(`${lock.path}.acquire`)
    await expect(acquireTargetLock(cwd, targetDir)).rejects.toMatchObject({
      code: 'CREATE_TARGET_LOCKED',
    })
    await expect(pathExists(`${lock.path}.acquire`)).resolves.toBe(true)
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

  it('并发恢复遗留锁时只有一个流程能够获取新锁', async () => {
    const targetDir = await createWorkspace()
    const abandonedLock = await acquireTargetLock(cwd, targetDir)
    await mkdir(targetDir)
    await writeFile(path.join(targetDir, 'partial.txt'), 'partial\n')
    await markOwnerDead(abandonedLock.path)

    const results = await Promise.allSettled([
      acquireTargetLock(cwd, targetDir),
      acquireTargetLock(cwd, targetDir),
    ])
    const acquired = results.filter(
      (
        result,
      ): result is PromiseFulfilledResult<
        Awaited<ReturnType<typeof acquireTargetLock>>
      > => result.status === 'fulfilled',
    )
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    )

    expect(acquired).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0].reason).toMatchObject({ code: 'CREATE_TARGET_LOCKED' })
    await expect(pathExists(targetDir)).resolves.toBe(false)
    await releaseTargetLock(acquired[0].value)
  })

  it('进程异常退出后可以接管遗留的锁获取互斥目录', async () => {
    const targetDir = await createWorkspace()
    const initialLock = await acquireTargetLock(cwd, targetDir)
    await releaseTargetLock(initialLock)
    const acquisitionPath = `${initialLock.path}.acquire`
    const deadPid = 2_147_483_647
    const deadOwnerId = randomUUID()
    await mkdir(acquisitionPath)
    await writeFile(
      path.join(acquisitionPath, 'owner.json'),
      JSON.stringify({
        version: 1,
        ownerId: deadOwnerId,
        pid: deadPid,
        hostname: hostname(),
        createdAt: new Date().toISOString(),
      }),
    )
    mockProcessDead(deadPid)

    const recoveredLock = await acquireTargetLock(cwd, targetDir)

    await expect(pathExists(acquisitionPath)).resolves.toBe(false)
    await expect(
      pathExists(`${acquisitionPath}.${deadOwnerId}.abandoned`),
    ).resolves.toBe(true)
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
    const deadPid = 2_147_483_647
    metadata.pid = deadPid
    await writeFile(lockPath, JSON.stringify(metadata))
    mockProcessDead(deadPid)
  }

  async function relocateLegacyLock(
    lockPath: string,
    originalCwd: string,
    targetDir: string,
  ): Promise<string> {
    const metadata = JSON.parse(await readFile(lockPath, 'utf8'))
    metadata.version = 1
    delete metadata.cwd
    delete metadata.phase
    delete metadata.recoveryPhase
    const targetHash = createHash('sha256').update(targetDir).digest('hex')
    const legacyPath = path.join(originalCwd, `.eljs-create-${targetHash}.lock`)
    await writeFile(legacyPath, JSON.stringify(metadata))
    if (legacyPath !== lockPath) {
      await rm(lockPath)
    }
    return legacyPath
  }

  function mockProcessDead(deadPid: number): void {
    vi.spyOn(process, 'kill').mockImplementation(pid => {
      if (pid === deadPid) {
        throw Object.assign(new Error('No such process'), { code: 'ESRCH' })
      }
      return true
    })
  }
})
