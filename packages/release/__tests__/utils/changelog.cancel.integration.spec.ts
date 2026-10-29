import {
  execFileSync,
  spawn,
  spawnSync,
  type ChildProcess,
} from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import createPreset from '@eljs/conventional-changelog-preset'
import { getChangelog } from '../../src/utils/changelog'

vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return { ...actual, spawn: vi.fn(actual.spawn) }
})

vi.mock('@eljs/conventional-changelog-preset', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@eljs/conventional-changelog-preset')>()
  return { ...actual, default: vi.fn(actual.default) }
})

describe('更新日志取消真实 Git 集成', () => {
  let cwd: string | undefined
  const children: ChildProcess[] = []

  afterEach(() => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGCONT')
        child.kill('SIGKILL')
      }
    }
    children.length = 0
    if (cwd) {
      rmSync(cwd, { recursive: true, force: true })
      cwd = undefined
    }
  })

  it('预取消不应启动真实 Git', async () => {
    const controller = new AbortController()
    controller.abort('pre-aborted')
    const mockedSpawn = vi.mocked(spawn)
    mockedSpawn.mockClear()

    await expect(
      getChangelog({ cwd: tmpdir(), signal: controller.signal }),
    ).rejects.toBe('pre-aborted')
    expect(mockedSpawn).not.toHaveBeenCalled()
  })

  it.each(['config', 'commits'] as const)(
    '%s 期间取消应在拒绝前关闭真实 Git 子进程',
    async phase => {
      cwd = mkdtempSync(path.join(tmpdir(), 'eljs-changelog-cancel-'))
      writeFileSync(
        path.join(cwd, 'package.json'),
        JSON.stringify({
          name: 'cancel-integration',
          version: '1.0.0',
          ...(phase === 'commits'
            ? {
                repository: {
                  type: 'git',
                  url: 'https://github.com/eljs/local-fixture.git',
                },
              }
            : {}),
        }),
      )
      const git = (args: string[], input?: string) =>
        execFileSync('git', args, { cwd, input, stdio: 'pipe' })
      git(['init'])
      git(['config', 'user.name', 'Eljs Test'])
      git(['config', 'user.email', 'test@eljs.dev'])
      git(['add', '.'])
      // 大提交正文让日志输出超过管道容量，确保被测 Git 在取消时仍真实存活
      git(
        ['commit', '-F', '-'],
        `feat(core): cancellation fixture\n\n${'body\n'.repeat(400_000)}`,
      )
      const controller = new AbortController()
      const reason = new DOMException('生成超时', 'TimeoutError')
      const add = vi.spyOn(controller.signal, 'addEventListener')
      const remove = vi.spyOn(controller.signal, 'removeEventListener')
      const realSpawn = (
        await vi.importActual<typeof import('node:child_process')>(
          'node:child_process',
        )
      ).spawn
      let target: ChildProcess | undefined
      vi.mocked(spawn).mockImplementation((...args) => {
        const child = realSpawn(...args)
        children.push(child)
        const gitArgs = args[1] as string[]
        const matches =
          phase === 'config'
            ? gitArgs[0] === 'config'
            : gitArgs.some(arg => arg.startsWith('--format='))
        if (matches && !target) {
          expect(args[2]).toMatchObject({ signal: expect.any(AbortSignal) })
          target = child
          // 暂停真实进程以消除快速 Git 命令退出的竞态，恢复后交付挂起的 SIGTERM
          child.kill('SIGSTOP')
          child.once('spawn', () => {
            controller.abort(reason)
            child.kill('SIGCONT')
          })
        }
        return child
      })

      await expect(
        getChangelog({ cwd, signal: controller.signal }),
      ).rejects.toBe(reason)
      expect(target?.pid).toBeTypeOf('number')
      expect(target?.signalCode).toBe('SIGTERM')
      expect(() => process.kill(target?.pid as number, 0)).toThrow(
        expect.objectContaining({ code: 'ESRCH' }),
      )
      expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1])
      const spawnCount = children.length
      await new Promise(resolve => setTimeout(resolve, 20))
      expect(children).toHaveLength(spawnCount)
      for (const child of children) {
        expect(child.exitCode !== null || child.signalCode !== null).toBe(true)
      }
    },
    30_000,
  )

  it('Git 失败应保留上游 stderr 错误并释放取消监听器', async () => {
    cwd = mkdtempSync(path.join(tmpdir(), 'eljs-changelog-failure-'))
    writeFileSync(path.join(cwd, 'package.json'), '{invalid')
    const controller = new AbortController()
    const add = vi.spyOn(controller.signal, 'addEventListener')
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    // Git 的诊断会随本机语言变化，使用同一非仓库目录的真实 stderr 验证透传
    const failure = spawnSync('git', ['rev-parse', '--git-dir'], {
      cwd,
      encoding: 'utf8',
    })
    expect(failure.error).toBeUndefined()
    expect(failure.status).not.toBe(0)
    expect(failure.stderr.trim()).not.toBe('')

    await expect(
      getChangelog({ cwd, signal: controller.signal }),
    ).rejects.toThrow(failure.stderr.trim())
    expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1])
  })

  it('等待预设初始化时取消应安全消费晚到拒绝且不启动 Git', async () => {
    cwd = mkdtempSync(path.join(tmpdir(), 'eljs-changelog-preset-'))
    writeFileSync(
      path.join(cwd, 'package.json'),
      JSON.stringify({
        name: 'pending-preset',
        version: '1.0.0',
        repository: {
          type: 'git',
          url: 'https://github.com/eljs/local-fixture.git',
        },
      }),
    )
    let rejectPreset: (error: Error) => void = () => {}
    vi.mocked(createPreset).mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectPreset = reject
      }),
    )
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const mockedSpawn = vi.mocked(spawn)
    mockedSpawn.mockClear()
    const result = getChangelog({ cwd, signal: controller.signal })
    const assertion = expect(result).rejects.toBe('pending-preset-canceled')
    await vi.waitFor(() => expect(createPreset).toHaveBeenCalledOnce())
    controller.abort('pending-preset-canceled')
    await assertion
    rejectPreset(new Error('预设晚到失败'))
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(mockedSpawn).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalledOnce()
  })
})
