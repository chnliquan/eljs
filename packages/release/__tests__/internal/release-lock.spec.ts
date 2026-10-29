import { spawn, type ChildProcess } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { realpathSync } from 'node:fs'
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  unlink,
  utimes,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

import { ReleaseLock } from '../../src/internal/release-lock'

describe('release 跨进程锁', () => {
  let cwd: string | undefined
  let lock: ReleaseLock | undefined
  let lockPath: string | undefined
  const children: ChildProcess[] = []

  afterEach(async () => {
    await Promise.all(
      children.splice(0).map(async child => {
        if (child.exitCode === null && child.signalCode === null) {
          const exited = once(child, 'exit')
          child.kill('SIGKILL')
          await exited
        }
      }),
    )
    await lock?.release()
    if (lockPath) {
      await unlink(lockPath).catch(() => undefined)
      const root = path.dirname(lockPath)
      for (const name of await readdir(root)) {
        if (name.startsWith(`${path.basename(lockPath)}.acquire`)) {
          await rm(path.join(root, name), { recursive: true, force: true })
        }
      }
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

  it('两个跨进程旧锁回收者只能产生一个新持有者', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-lock-race-'))
    lockPath = getLockPath(cwd)
    await mkdir(path.dirname(lockPath), { recursive: true, mode: 0o700 })
    await writeFile(
      lockPath,
      JSON.stringify({
        cwd: realpathSync(cwd),
        createdAt: new Date().toISOString(),
        pid: 2_147_483_647,
        token: 'stale-owner',
      }),
    )
    const contenders = [
      startContender(cwd, false, false, true),
      startContender(cwd, false, false, true),
    ]
    await Promise.all(contenders.map(child => waitMessage(child, 'ready')))
    const paused = contenders.map(child => waitMessage(child, 'publish-paused'))
    contenders.forEach(child => child.send('start'))
    await Promise.all(paused)
    const results = contenders.map(child => once(child, 'message'))
    contenders.forEach(child => child.send('continue'))
    const messages = (await Promise.all(results)).map(([message]) => message)

    expect([...messages].sort()).toEqual(['acquired', 'rejected'])
    const winner = contenders[messages.indexOf('acquired')]
    // 赢家仍存活并持有锁，失败的旧锁回收者不能删除它
    await expect(ReleaseLock.acquire(cwd)).rejects.toThrow(
      'Another release process',
    )
    const metadata = JSON.parse(await readFile(lockPath, 'utf8')) as {
      pid: number
    }
    expect(metadata.pid).toBe(winner.pid)
  })

  it('获取互斥内崩溃后并发回收应该保留不可变墓碑和后继锁', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-mutex-crash-'))
    lockPath = getLockPath(cwd)
    const crashed = startContender(cwd, true)
    await waitMessage(crashed, 'ready')
    const held = waitMessage(crashed, 'mutex-held')
    crashed.send('start')
    await held
    const old = JSON.parse(
      await readFile(path.join(`${lockPath}.acquire`, 'owner.json'), 'utf8'),
    ) as { ownerId: string }
    const exited = once(crashed, 'exit')
    crashed.kill('SIGKILL')
    await exited

    const results = await Promise.allSettled([
      ReleaseLock.acquire(cwd),
      ReleaseLock.acquire(cwd),
    ])
    const winners = results.filter(
      (result): result is PromiseFulfilledResult<ReleaseLock> =>
        result.status === 'fulfilled',
    )
    expect(winners).toHaveLength(1)
    lock = winners[0].value
    await expect(
      stat(`${lockPath}.acquire.${old.ownerId}.abandoned`),
    ).resolves.toBeDefined()
    await expect(ReleaseLock.acquire(cwd)).rejects.toThrow(
      'Another release process',
    )
  })

  it('缺损或越界 ownerId 的互斥元数据不应该被回收', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-mutex-invalid-'))
    lockPath = getLockPath(cwd)
    await mkdir(`${lockPath}.acquire`, { recursive: true, mode: 0o700 })
    await writeFile(path.join(`${lockPath}.acquire`, 'incomplete'), '')
    await expect(ReleaseLock.acquire(cwd)).rejects.toThrow(
      'Incomplete release mutex',
    )
    await writeFile(
      path.join(`${lockPath}.acquire`, 'owner.json'),
      JSON.stringify({
        ownerId: '../outside',
        pid: 2_147_483_647,
      }),
    )
    await expect(ReleaseLock.acquire(cwd)).rejects.toThrow(
      'Invalid release mutex',
    )
  })

  it('既有空互斥目录应该拒绝获取并保留原目录', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-mutex-empty-'))
    lockPath = getLockPath(cwd)
    const mutexPath = `${lockPath}.acquire`
    await mkdir(mutexPath, { recursive: true, mode: 0o700 })
    const original = await lstat(mutexPath)

    await expect(ReleaseLock.acquire(cwd)).rejects.toThrow(
      'Incomplete release mutex',
    )

    const retained = await lstat(mutexPath)
    expect(retained.isDirectory()).toBe(true)
    expect([retained.dev, retained.ino]).toEqual([original.dev, original.ino])
    expect(await readdir(mutexPath)).toEqual([])
    await expect(lstat(lockPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('公共互斥是普通文件时应该拒绝获取并保留内容', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-mutex-file-'))
    lockPath = getLockPath(cwd)
    const mutexPath = `${lockPath}.acquire`
    await mkdir(path.dirname(lockPath), { recursive: true, mode: 0o700 })
    await writeFile(mutexPath, 'incomplete mutex')

    await expect(ReleaseLock.acquire(cwd)).rejects.toThrow(
      'Unsafe release mutex directory',
    )

    expect((await lstat(mutexPath)).isFile()).toBe(true)
    expect(await readFile(mutexPath, 'utf8')).toBe('incomplete mutex')
    await expect(lstat(lockPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it.each([false, true])(
    '公共互斥是符号链接时应该拒绝获取并保留目标，dangling=%s',
    async dangling => {
      cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-mutex-symlink-'))
      lockPath = getLockPath(cwd)
      const mutexPath = `${lockPath}.acquire`
      const target = path.join(cwd, 'mutex-target')
      const metadata = JSON.stringify({
        ownerId: randomUUID(),
        pid: 2_147_483_647,
      })
      await mkdir(path.dirname(lockPath), { recursive: true, mode: 0o700 })
      if (!dangling) {
        await mkdir(target, { mode: 0o700 })
        await writeFile(path.join(target, 'owner.json'), metadata)
      }
      await symlink(
        target,
        mutexPath,
        process.platform === 'win32' ? 'junction' : 'dir',
      )

      await expect(ReleaseLock.acquire(cwd)).rejects.toThrow(
        'Unsafe release mutex directory',
      )

      expect((await lstat(mutexPath)).isSymbolicLink()).toBe(true)
      if (dangling) {
        await expect(lstat(target)).rejects.toMatchObject({ code: 'ENOENT' })
      } else {
        expect(await readFile(path.join(target, 'owner.json'), 'utf8')).toBe(
          metadata,
        )
      }
      await expect(lstat(lockPath)).rejects.toMatchObject({ code: 'ENOENT' })
    },
  )

  it('延迟的旧互斥回收者不能移动仍存活的后继互斥', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-delayed-reclaim-'))
    lockPath = getLockPath(cwd)
    const ownerId = randomUUID()
    await mkdir(`${lockPath}.acquire`, { recursive: true, mode: 0o700 })
    await writeFile(
      path.join(`${lockPath}.acquire`, 'owner.json'),
      JSON.stringify({
        ownerId,
        pid: 2_147_483_647,
      }),
    )
    const delayed = startContender(cwd, false, true)
    await waitMessage(delayed, 'ready')
    const paused = waitMessage(delayed, 'reclaim-paused')
    delayed.send('start')
    await paused

    const successor = startContender(cwd, true)
    await waitMessage(successor, 'ready')
    const held = waitMessage(successor, 'mutex-held')
    successor.send('start')
    await held
    const current = await readFile(
      path.join(`${lockPath}.acquire`, 'owner.json'),
      'utf8',
    )
    const attempted = waitMessage(delayed, 'reclaim-attempted')
    delayed.send('continue')
    await attempted

    expect(
      await readFile(path.join(`${lockPath}.acquire`, 'owner.json'), 'utf8'),
    ).toBe(current)
    expect(successor.exitCode).toBeNull()
    expect(successor.signalCode).toBeNull()
    await expect(
      stat(`${lockPath}.acquire.${ownerId}.abandoned`),
    ).resolves.toBeDefined()
    for (const child of [delayed, successor]) {
      const exited = once(child, 'exit')
      child.kill('SIGKILL')
      await exited
    }
    lock = await ReleaseLock.acquire(cwd)
  })

  it('旧持有者重复释放不应该删除新持有者', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-old-owner-'))
    lockPath = getLockPath(cwd)
    const old = await ReleaseLock.acquire(cwd)
    await old.release()
    lock = await ReleaseLock.acquire(cwd)
    await Promise.all([old.release(), old.release()])
    await expect(ReleaseLock.acquire(cwd)).rejects.toThrow(
      'Another release process',
    )
  })

  function startContender(
    workspace: string,
    crash = false,
    pauseReclaim = false,
    pausePublish = false,
  ): ChildProcess {
    const source = pathToFileURL(
      fileURLToPath(
        new URL('../../src/internal/release-lock.ts', import.meta.url),
      ),
    ).href
    const child = spawn(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '--eval',
        `
        import fs from 'node:fs/promises'
        import { syncBuiltinESMExports } from 'node:module'
        if (${JSON.stringify(crash)}) {
          const open = fs.open
          fs.open = async (...args) => {
            if (args[0] === ${JSON.stringify(getLockPath(workspace))}) {
              process.send('mutex-held')
              await new Promise(() => {})
            }
            return open(...args)
          }
        }
        if (${JSON.stringify(pauseReclaim || pausePublish)}) {
          const rename = fs.rename
          let paused = false
          fs.rename = async (...args) => {
            if (!paused && (
              (${JSON.stringify(pauseReclaim)} && args[1].endsWith('.abandoned')) ||
              (${JSON.stringify(pausePublish)} && args[1] === ${JSON.stringify(`${getLockPath(workspace)}.acquire`)})
            )) {
              paused = true
              process.send(${JSON.stringify(pausePublish ? 'publish-paused' : 'reclaim-paused')})
              await new Promise(resolve => process.once('message', resolve))
              try {
                return await rename(...args)
              } finally {
                if (${JSON.stringify(pauseReclaim)}) process.send('reclaim-attempted')
              }
            }
            return rename(...args)
          }
        }
        syncBuiltinESMExports()
        const { ReleaseLock } = await import(${JSON.stringify(source)})
        // IPC 监听需先于阻塞点保活，未兑现的 Promise 本身不能阻止子进程退出
        process.on('message', () => {})
        process.send('ready')
        process.once('message', async () => {
          try {
            await ReleaseLock.acquire(${JSON.stringify(workspace)})
            process.send('acquired')
          } catch {
            process.send('rejected')
          }
        })
      `,
      ],
      { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] },
    )
    children.push(child)
    return child
  }

  async function waitMessage(
    child: ChildProcess,
    expected: string,
  ): Promise<void> {
    const [message] = await once(child, 'message')
    expect(message).toBe(expected)
  }

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
