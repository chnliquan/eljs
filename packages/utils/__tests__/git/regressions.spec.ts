import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { inspect, promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as cp from '../../src/cp'
import { cloneGitRepository } from '../../src/git/download'
import { isGitAheadRemote, isGitBehindRemote } from '../../src/git/is'
import { gitCommit, gitPush } from '../../src/git/operations'

vi.mock('../../src/cp', async importOriginal => {
  const actual = await importOriginal<typeof cp>()
  return { ...actual, run: vi.fn(actual.run) }
})

const actualCp = await vi.importActual<typeof cp>('../../src/cp')
const execute = promisify(execFile)

describe('Git 命令回归', () => {
  let root: string
  let cwd: string
  let env: NodeJS.ProcessEnv

  const git = (args: string[], directory = cwd) =>
    execute('git', args, { cwd: directory, env })

  beforeEach(async () => {
    vi.mocked(cp.run).mockImplementation(actualCp.run)
    root = await mkdtemp(path.join(os.tmpdir(), 'eljs-git-regression-'))
    cwd = path.join(root, 'repo')
    env = {
      ...process.env,
      LC_ALL: 'C',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: path.join(root, 'absent-config'),
      GIT_AUTHOR_NAME: 'Fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
      GIT_COMMITTER_NAME: 'Fixture',
      GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
      GIT_TERMINAL_PROMPT: '0',
    }
    await mkdir(cwd)
    await mkdir(path.join(root, 'hooks'))
    await git(['init', '-b', 'main'])
    await git(['config', 'commit.gpgsign', 'false'])
    await git(['config', 'core.hooksPath', path.join(root, 'hooks')])
    await git(['commit', '--allow-empty', '-m', 'base'])
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('真实提交应写入暂存内容，干净工作区重复提交应成功返回', async () => {
    await writeFile(path.join(cwd, 'file.txt'), 'content')
    await gitCommit('fixture commit', { cwd, env })
    expect((await git(['show', 'HEAD:file.txt'])).stdout).toBe('content')
    const before = (await git(['rev-parse', 'HEAD'])).stdout
    await expect(gitCommit('no changes', { cwd, env })).resolves.toBeUndefined()
    expect((await git(['rev-parse', 'HEAD'])).stdout).toBe(before)
  })

  it('真实 Execa spawn 失败包含凭据时仅输出安全分类和 errno', async () => {
    const url =
      'https://fixture-user:fixture-password@example.invalid/repo?fixture-query=fixture-value#main'
    let original: unknown
    vi.mocked(cp.run).mockImplementation(((command, args, options) => {
      const child = actualCp.run(command, args as string[], {
        ...options,
        env: { ...env, PATH: path.join(root, 'missing-bin') },
        preferLocal: false,
      })
      return child.catch(error => {
        original = error
        throw error
      })
    }) as typeof cp.run)

    const error = await cloneGitRepository(url, { dest: cwd }).catch(
      error => error,
    )
    expect(original).toMatchObject({ code: 'ENOENT' })
    expect(inspect(original, { depth: null })).toContain('fixture-password')
    expect(error).toMatchObject({
      code: 'ERR_PROCESS_SPAWN',
      operation: 'git.clone',
      details: { errno: 'ENOENT', source: 'https://example.invalid/repo' },
    })
    for (const output of [
      inspect(error, { depth: null }),
      JSON.stringify(error),
      error.stack,
    ]) {
      expect(output).not.toMatch(
        /fixture-user|fixture-password|fixture-query|fixture-value/u,
      )
    }
  })

  it.each([{}, { encoding: 'buffer' }, { lines: true }] as const)(
    '无变更的已有仓库和初始空仓库兼容输出选项 %j',
    async outputOptions => {
      const before = (await git(['rev-parse', 'HEAD'])).stdout
      await expect(
        gitCommit('no changes', { cwd, env, ...outputOptions }),
      ).resolves.toBeUndefined()
      expect((await git(['rev-parse', 'HEAD'])).stdout).toBe(before)

      const empty = path.join(root, 'empty')
      await mkdir(empty)
      await git(['init', '-b', 'main'], empty)
      await expect(
        gitCommit('still empty', { cwd: empty, env, ...outputOptions }),
      ).resolves.toBeUndefined()
      await expect(
        git(['rev-parse', '--verify', 'HEAD'], empty),
      ).rejects.toThrow()
    },
  )

  it.each(['nothing to commit', '无文件要提交'])(
    '提交信息包含 %s 时不能吞掉无效选项错误',
    async message => {
      await expect(
        gitCommit(message, ['--eljs-invalid-option'], { cwd, env }),
      ).rejects.toMatchObject({
        exitCode: 129,
        stderr: expect.stringContaining('unknown option'),
        message: expect.stringContaining('Git commit failed:'),
      })
    },
  )

  it('无提交内容的措辞出现在 git add 错误中时仍应失败', async () => {
    const missing = path.join(root, 'nothing to commit')
    await expect(gitCommit('test', { cwd: missing, env })).rejects.toThrow(
      'Git commit failed:',
    )
  })

  it('本地远端分叉时应同时报告 ahead 和 behind，文件名不应影响状态', async () => {
    const remote = path.join(root, 'remote')
    await git(['clone', '--no-local', cwd, remote], root)
    await git(['remote', 'add', 'origin', remote])
    await git(['fetch', 'origin'])
    await git(['branch', '--set-upstream-to=origin/main', 'main'])
    await writeFile(path.join(cwd, 'file [ahead 9, behind 9]'), 'untracked')
    expect(await isGitAheadRemote({ cwd, env })).toBe(false)
    expect(await isGitBehindRemote({ cwd, env })).toBe(false)

    await git(['commit', '--allow-empty', '-m', 'local'])
    expect(await isGitAheadRemote({ cwd, env })).toBe(true)
    expect(await isGitBehindRemote({ cwd, env })).toBe(false)
    await git(
      ['-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'remote'],
      remote,
    )
    expect(await isGitAheadRemote({ cwd, env })).toBe(true)
    expect(await isGitBehindRemote({ cwd, env })).toBe(true)
  })

  it.each([
    { stdout: 'ignore' },
    { stdout: 'inherit' },
    { stdio: 'ignore' },
    { stdio: 'inherit' },
  ] as const)(
    '真实分支查询在 %j 时仍能构造推送命令（推送已拦截）',
    async outputOptions => {
      const pushes: string[][] = []
      vi.mocked(cp.run).mockImplementation(((command, args, options) => {
        if (Array.isArray(args) && args[0] === 'push') {
          pushes.push(args)
          return Promise.resolve({
            stdout: '',
            stderr: '',
            exitCode: 0,
          }) as ReturnType<typeof cp.run>
        }
        return actualCp.run(command, args as string[], options)
      }) as typeof cp.run)

      const options = {
        cwd,
        env,
        ...outputOptions,
        encoding: 'buffer',
        lines: true,
        buffer: false,
      } as const
      await gitPush([], options)
      expect(pushes).toEqual([['push', '--set-upstream', 'origin', 'main']])

      await git(['config', 'branch.main.remote', '.'])
      await git(['config', 'branch.main.merge', 'refs/heads/main'])
      await gitPush([], options)
      expect(pushes[1]).toEqual(['push'])
      expect(cp.run).toHaveBeenLastCalledWith('git', ['push'], options)
    },
  )
})
