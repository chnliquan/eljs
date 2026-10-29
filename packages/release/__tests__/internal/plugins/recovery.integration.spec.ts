import { run } from '@eljs/utils/cp'
import { gitTag } from '@eljs/utils/git'
import { logger } from '@eljs/utils/logger'
import { execFile } from 'node:child_process'
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { defaultConfig } from '../../../src/default'
import * as changelogPaths from '../../../src/internal/changelog-path'
import gitPlugin from '../../../src/internal/plugins/git'
import versionPlugin from '../../../src/internal/plugins/version'
import { ReleaseRunner } from '../../../src/release-runner'
import type { AppData, ReleasePluginContext } from '../../../src/types'
import {
  getRemoteDistTag,
  isGitTagAtHead,
  isVersionExist,
  updatePackageLock,
} from '../../../src/utils'

vi.mock('../../../src/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../src/utils')>()),
  isVersionExist: vi.fn(async () => false),
  getRemoteDistTag: vi.fn(() => {
    throw new Error('Network is forbidden')
  }),
  updatePackageLock: vi.fn(async () => undefined),
  getChangelog: vi.fn(async () => info.changelog),
}))
vi.mock('@eljs/utils/cp', async importOriginal => {
  const actual = await importOriginal<typeof import('@eljs/utils/cp')>()
  return { ...actual, run: vi.fn(actual.run) }
})
vi.mock('@eljs/plugin-host/plugin/plugin-loader', () => ({
  loadPluginInitializer: vi.fn(async (file: string) => {
    // 真实 loader 的 CommonJS 转译绕过 Vitest mock，必须固定内置模块图以阻止网络和发布
    if (file.endsWith('/internal/index.ts')) {
      return (await import('../../../src/internal/index')).default
    }
    const name = path.basename(file, '.ts')
    if (name === 'bootstrap')
      return (await import('../../../src/internal/plugins/bootstrap')).default
    if (name === 'version') return versionPlugin
    if (name === 'git') return gitPlugin
    if (name === 'npm')
      return (await import('../../../src/internal/plugins/npm')).default
    if (name === 'github')
      return (await import('../../../src/internal/plugins/github')).default
    if (file.endsWith('fixture-plugin.mjs')) return (await import(file)).default
    throw new Error(`Unexpected plugin load: ${file}`)
  }),
}))
vi.mock('@eljs/utils/git', async importOriginal => ({
  ...(await importOriginal<typeof import('@eljs/utils/git')>()),
  gitTag: vi.fn(),
  gitPush: vi.fn(() => {
    throw new Error('Push is forbidden')
  }),
}))

const execute = promisify(execFile)
const info = {
  version: '1.1.0',
  isPrerelease: false,
  prereleaseId: null,
  changelog: '## 1.1.0\n\n- fixture',
}
type LifecycleRegistration = (
  handler: (args: typeof info) => Promise<void>,
  options?: { stage?: number },
) => void

describe('发布中断恢复的本地事务', () => {
  let cwd = ''
  const initializerKeys: string[] = []

  afterEach(async () => {
    if (cwd) await rm(cwd, { recursive: true, force: true })
    for (const key of initializerKeys.splice(0))
      Reflect.deleteProperty(globalThis, key)
    vi.resetAllMocks()
  })

  it('独立标签中途失败后 --retry 应补齐标签并保持提交和日志不变', async () => {
    const context = await fixture()
    const actual =
      await vi.importActual<typeof import('@eljs/utils/git')>('@eljs/utils/git')
    vi.mocked(gitTag).mockImplementation(async (tag, options) => {
      if (tag === 'pkg-b@1.1.0') throw new Error('fixture tag interruption')
      return actual.gitTag(tag, options)
    })
    await bump(context)
    await context.onBeforeRelease.mock.calls[0][0](info)
    await expect(context.onRelease.mock.calls[0][0](info)).rejects.toThrow(
      'fixture tag interruption',
    )
    for (const [handler] of context.onError.mock.calls) await handler(info)
    expect(context.appData.projectPkg.version).toBe('1.1.0')
    const head = await git('rev-parse', 'HEAD')
    await git('tag', 'unrelated@99.0.0')
    const changelog = await readFile(path.join(cwd, 'CHANGELOG.md'), 'utf8')
    expect(await isGitTagAtHead('pkg-a@1.1.0', { cwd })).toBe(true)
    expect(await isGitTagAtHead('pkg-b@1.1.0', { cwd })).toBe(false)

    const retry = await fixtureContext()
    const version = await retry.getIncrementVersion.mock.calls[0][0]({
      retry: true,
    })
    expect(version).toBe('1.1.0')
    expect(getRemoteDistTag).not.toHaveBeenCalled()
    vi.mocked(gitTag).mockImplementation(actual.gitTag)
    await bump(retry)
    expect(retry.appData.isReleaseRetry).toBe(true)
    await retry.onBeforeRelease.mock.calls[0][0](info)
    for (const [handler] of retry.onRelease.mock.calls) await handler(info)

    expect(await git('rev-parse', 'HEAD')).toBe(head)
    expect(await git('rev-list', '--count', 'HEAD')).toBe('2')
    expect(await readFile(path.join(cwd, 'CHANGELOG.md'), 'utf8')).toBe(
      changelog,
    )
    expect(await isGitTagAtHead('pkg-a@1.1.0', { cwd })).toBe(true)
    expect(await isGitTagAtHead('pkg-b@1.1.0', { cwd })).toBe(true)
    expect(await git('status', '--porcelain')).toBe('')
    expect(gitTag).toHaveBeenLastCalledWith(
      'pkg-b@1.1.0',
      expect.objectContaining({ cwd }),
    )
  })

  it.each([
    'getChangelog',
    'beforeChangelog',
    'afterChangelog',
    'afterPreflight',
    'beforePreflight',
    'gitCommitEntry',
    'npmEntry',
    'afterDirectories',
  ] as const)('真实 runner 在 %s 取消时恢复全部内置文件与内存', async point => {
    await fixture()
    const originals = await prepareOriginalFiles()
    const head = await git('rev-parse', 'HEAD')
    let captured: ReleasePluginContext | undefined
    const controller = new AbortController()
    const failure = new Error(`cancel at ${point}`)
    if (point === 'afterDirectories') {
      const resolve = changelogPaths.resolveChangelogPath
      let calls = 0
      vi.spyOn(changelogPaths, 'resolveChangelogPath').mockImplementation(
        async (...args) => {
          if (++calls === 2) {
            expect(
              (await stat(path.join(cwd, 'new/nested'))).isDirectory(),
            ).toBe(true)
            controller.abort(failure)
          }
          return resolve(...args)
        },
      )
    }
    const runner = await createRunner(
      context => {
        captured = context
        const cancel = () => controller.abort(failure)
        if (point === 'getChangelog') {
          context.getChangelog(
            () => {
              cancel()
              return info.changelog
            },
            { stage: -10 },
          )
        } else if (point === 'beforeChangelog' || point === 'afterChangelog') {
          context.onBeforeRelease(
            async () => {
              if (point === 'afterChangelog') {
                expect(
                  await readFile(
                    path.join(cwd, 'new/nested/CHANGELOG.md'),
                    'utf8',
                  ),
                ).toContain('1.1.0')
              }
              cancel()
            },
            { stage: point === 'beforeChangelog' ? -10 : 10 },
          )
        } else if (point === 'afterPreflight' || point === 'beforePreflight') {
          context.onRelease(
            () => {
              cancel()
            },
            { stage: point === 'afterPreflight' ? -15 : -25 },
          )
        }
      },
      { signal: controller.signal, git: { commit: point !== 'npmEntry' } },
    )
    if (point === 'gitCommitEntry' || point === 'npmEntry') {
      vi.spyOn(runner, 'step').mockImplementation(message => {
        if (
          message ===
          (point === 'gitCommitEntry'
            ? 'Committing changes ...'
            : 'Publishing packages in dependency order ...')
        ) {
          controller.abort(failure)
        }
      })
    }

    await expect(runner.run(info.version)).rejects.toThrow()
    expect(controller.signal.reason).toBe(failure)
    await assertOriginalFiles(originals)
    expect(captured?.appData.projectPkg.version).toBe('1.0.0')
    expect(
      captured?.appData.workspacePackages.map(pkg => pkg.manifest.version),
    ).toEqual(['1.0.0', '1.0.0'])
    expect(await git('rev-parse', 'HEAD')).toBe(head)
    expect(await git('tag')).toBe('')
    expect(run).not.toHaveBeenCalledWith(
      'npm',
      expect.anything(),
      expect.anything(),
    )
  })

  it('清理失败只警告并保留原始 Hook 失败，其他快照仍继续恢复', async () => {
    await fixture()
    const originals = await prepareOriginalFiles()
    const warning = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const runner = await createRunner(context => {
      context.onBeforeRelease(
        async () => {
          const file = manifestPaths()[1]
          await rm(file)
          await mkdir(file)
          throw new Error('original hook failure')
        },
        { stage: 10 },
      )
    })
    await expect(runner.run(info.version)).rejects.toThrow(
      'original hook failure',
    )
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining('Release error hook failed'),
    )
    expect(runner.appData.projectPkg.version).toBe('1.0.0')
    expect(await readFile(originals[0].path)).toEqual(originals[0].content)
    expect(await readFile(originals[3].path)).toEqual(originals[3].content)
    await expect(stat(path.join(cwd, 'new'))).rejects.toMatchObject({
      code: 'ENOENT',
    })
    expect(await git('rev-list', '--count', 'HEAD')).toBe('1')
    expect(run).not.toHaveBeenCalledWith(
      'npm',
      expect.anything(),
      expect.anything(),
    )
  })

  it.each([false, true])(
    'changelog 回滚保留字节权限与未知 Hook 文件，existing=%s',
    async existing => {
      await fixture()
      const originals = await prepareOriginalFiles()
      const changelogPath = path.join(cwd, 'new/nested/CHANGELOG.md')
      const originalChangelog = Buffer.from(
        '# Old\r\n\r\n  unchanged bytes \r\n',
      )
      if (existing) {
        await mkdir(path.dirname(changelogPath), { recursive: true })
        await writeFile(changelogPath, originalChangelog, { mode: 0o604 })
      }
      const runner = await createRunner(context => {
        context.onBeforeRelease(
          async () => {
            await writeFile(
              path.join(cwd, 'new/nested/custom.txt'),
              'custom hook',
            )
            throw new Error('after changelog failure')
          },
          { stage: 10 },
        )
      })
      await expect(runner.run(info.version)).rejects.toThrow(
        'after changelog failure',
      )
      await assertOriginalFiles(originals, false)
      if (existing) {
        expect(await readFile(changelogPath)).toEqual(originalChangelog)
        expect((await stat(changelogPath)).mode & 0o777).toBe(0o604)
      } else {
        await expect(stat(changelogPath)).rejects.toMatchObject({
          code: 'ENOENT',
        })
      }
      expect(
        await readFile(path.join(cwd, 'new/nested/custom.txt'), 'utf8'),
      ).toBe('custom hook')
      expect(await git('rev-list', '--count', 'HEAD')).toBe('1')
    },
  )

  it.each([true, false])(
    'npm 命令失败后保留可能已生效的版本，commit=%s',
    async commit => {
      await fixture()
      await prepareOriginalFiles()
      const actual =
        await vi.importActual<typeof import('@eljs/utils/cp')>('@eljs/utils/cp')
      vi.mocked(run).mockImplementation((command, args, options) => {
        if (command === 'npm') throw new Error('publish response lost')
        return actual.run(command, args, options)
      })
      const actualGit =
        await vi.importActual<typeof import('@eljs/utils/git')>(
          '@eljs/utils/git',
        )
      vi.mocked(gitTag).mockImplementation(actualGit.gitTag)
      const runner = await createRunner(() => {}, { git: { commit } })
      await expect(runner.run(info.version)).rejects.toMatchObject({
        cause: {
          cause: {
            message: 'Release operation failed',
            name: 'ReleaseCommandError',
          },
        },
      })
      expect(runner.appData.projectPkg.version).toBe('1.1.0')
      for (const file of manifestPaths()) {
        expect(JSON.parse(await readFile(file, 'utf8')).version).toBe('1.1.0')
      }
      expect(await readFile(path.join(cwd, 'pnpm-lock.yaml'), 'utf8')).toBe(
        'updated lock',
      )
      expect(await git('rev-list', '--count', 'HEAD')).toBe(commit ? '2' : '1')
      if (commit)
        expect(await isGitTagAtHead('pkg-a@1.1.0', { cwd })).toBe(true)
      expect(run).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['publish']),
        expect.anything(),
      )
    },
  )

  it('dryRun 成功保留内存预演而不写文件', async () => {
    await fixture()
    const originals = await prepareOriginalFiles()
    const runner = await createRunner(() => {}, { dryRun: true })
    await runner.run(info.version)
    expect(runner.appData.projectPkg.version).toBe('1.1.0')
    await assertOriginalFiles(originals)
    expect(run).not.toHaveBeenCalledWith(
      'npm',
      expect.anything(),
      expect.anything(),
    )
  })

  it.each([false, true])(
    '部分 HEAD 标签不能放过已发布包的冲突，published=%s',
    async published => {
      await fixture()
      await git('tag', 'pkg-b@1.1.0')
      const oldTag = await git('rev-parse', 'pkg-b@1.1.0')
      await setVersions('1.1.0')
      await git('add', '.')
      await git('commit', '-m', 'release fixture')
      await git('tag', 'pkg-a@1.1.0')
      const retry = await fixtureContext()
      vi.mocked(isVersionExist).mockImplementation(
        async name => published && name === 'pkg-b',
      )
      if (published) {
        await expect(
          retry.onBeforeBumpVersion.mock.calls[0][0](info),
        ).rejects.toThrow('has been published already')
      } else {
        await bump(retry)
        expect(retry.appData.isReleaseRetry).toBe(true)
        const actual =
          await vi.importActual<typeof import('@eljs/utils/git')>(
            '@eljs/utils/git',
          )
        vi.mocked(gitTag).mockImplementation(actual.gitTag)
        await expect(retry.onRelease.mock.calls[0][0](info)).rejects.toThrow(
          'already exists',
        )
      }
      expect(await git('rev-parse', 'pkg-b@1.1.0')).toBe(oldTag)
    },
  )

  it('部分标签但包版本不一致时不应该识别为重试', async () => {
    await fixture()
    await git('tag', 'pkg-a@1.1.0')
    const context = await fixtureContext()
    await context.onBeforeBumpVersion.mock.calls[0][0](info)
    expect(context.appData.isReleaseRetry).toBe(false)
  })

  it.each([false, true])(
    '锁文件更新取消后恢复清单、锁文件和内存，preAborted=%s',
    async preAborted => {
      const context = await fixture()
      const originalManifests = await Promise.all(
        manifestPaths().map(file => readFile(file)),
      )
      const lockPath = path.join(cwd, 'pnpm-lock.yaml')
      const originalLock = Buffer.from('lockfileVersion: 9\n')
      await writeFile(lockPath, originalLock, { mode: 0o640 })
      const mode = (await stat(lockPath)).mode & 0o777
      await context.onBeforeBumpVersion.mock.calls[0][0](info)
      await context.onBumpVersion.mock.calls[0][0](info)
      const controller = new AbortController()
      const reason = new Error('fixture cancelled')
      context.signal = controller.signal
      if (preAborted) controller.abort(reason)
      vi.mocked(updatePackageLock).mockImplementation(
        async (_manager, options) => {
          expect(options?.signal).toBe(controller.signal)
          options?.signal?.throwIfAborted()
          await writeFile(lockPath, 'partially updated')
          await writeFile(path.join(cwd, 'package-lock.json'), '{}')
          controller.abort(reason)
          options?.signal?.throwIfAborted()
        },
      )

      await expect(
        context.onAfterBumpVersion.mock.calls[0][0](info),
      ).rejects.toBe(reason)
      for (const [index, file] of manifestPaths().entries()) {
        expect(await readFile(file)).toEqual(originalManifests[index])
      }
      expect(await readFile(lockPath)).toEqual(originalLock)
      expect((await stat(lockPath)).mode & 0o777).toBe(mode)
      await expect(
        stat(path.join(cwd, 'package-lock.json')),
      ).rejects.toMatchObject({ code: 'ENOENT' })
      expect(context.appData.projectPkg.version).toBe('1.0.0')
      expect(
        context.appData.workspacePackages.map(pkg => pkg.manifest.version),
      ).toEqual(['1.0.0', '1.0.0'])
    },
  )

  async function fixture() {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-recovery-'))
    await mkdir(path.join(cwd, 'a'))
    await mkdir(path.join(cwd, 'b'))
    await setVersions('1.0.0')
    await git('init')
    await git('config', 'user.name', 'Release Fixture')
    await git('config', 'user.email', 'fixture@example.invalid')
    await git('config', 'commit.gpgsign', 'false')
    await git('config', 'tag.gpgsign', 'false')
    await git('add', '.')
    await git('commit', '-m', 'initial fixture')
    vi.mocked(isVersionExist).mockResolvedValue(false)
    vi.mocked(updatePackageLock).mockResolvedValue(undefined)
    const actual =
      await vi.importActual<typeof import('@eljs/utils/cp')>('@eljs/utils/cp')
    vi.mocked(run).mockImplementation((command, args, options) => {
      if (command === 'npm')
        throw new Error('Network and publish are forbidden')
      return actual.run(command, args, options)
    })
    return fixtureContext()
  }

  async function prepareOriginalFiles() {
    for (const [index, file] of manifestPaths().entries()) {
      // 故意使用非标准格式，确保恢复的是字节而非重新序列化的 JSON
      const manifest = JSON.parse(await readFile(file, 'utf8'))
      await writeFile(file, JSON.stringify(manifest) + '\r\n  ')
      await chmod(file, index === 0 ? 0o640 : 0o604)
    }
    await writeFile(path.join(cwd, 'pnpm-lock.yaml'), 'original lock\r\n', {
      mode: 0o640,
    })
    await writeFile(
      path.join(cwd, 'pnpm-workspace.yaml'),
      'packages:\n  - a\n  - b\n',
    )
    vi.mocked(updatePackageLock).mockImplementation(async () => {
      await writeFile(path.join(cwd, 'pnpm-lock.yaml'), 'updated lock')
      await chmod(path.join(cwd, 'pnpm-lock.yaml'), 0o600)
      await writeFile(path.join(cwd, 'package-lock.json'), '{}')
    })
    return Promise.all(
      [...manifestPaths(), path.join(cwd, 'pnpm-lock.yaml')].map(
        async file => ({
          path: file,
          content: await readFile(file),
          mode: (await stat(file)).mode & 0o777,
        }),
      ),
    )
  }

  async function assertOriginalFiles(
    originals: Awaited<ReturnType<typeof prepareOriginalFiles>>,
    missingDirectory = true,
  ) {
    for (const original of originals) {
      expect(await readFile(original.path)).toEqual(original.content)
      expect((await stat(original.path)).mode & 0o777).toBe(original.mode)
    }
    await expect(
      stat(path.join(cwd, 'package-lock.json')),
    ).rejects.toMatchObject({ code: 'ENOENT' })
    if (missingDirectory) {
      await expect(stat(path.join(cwd, 'new'))).rejects.toMatchObject({
        code: 'ENOENT',
      })
    }
  }

  async function createRunner(
    initialize: (context: ReleasePluginContext) => void,
    overrides: ConstructorParameters<typeof ReleaseRunner>[0] = {},
  ) {
    const key = `__releaseRecovery${Date.now()}${Math.random()}`
    Reflect.set(globalThis, key, initialize)
    initializerKeys.push(key)
    const plugin = path.join(cwd, 'fixture-plugin.mjs')
    await writeFile(
      plugin,
      `export default context => Reflect.get(globalThis, ${JSON.stringify(key)})(context)`,
    )
    const runner = new ReleaseRunner({
      cwd,
      ...overrides,
      git: {
        independent: true,
        push: false,
        requireClean: false,
        changelog: { filename: 'new/nested/CHANGELOG.md' },
        ...overrides.git,
      },
      npm: { requireOwner: false, confirm: false },
      github: { release: false },
      plugins: [plugin],
    })
    return runner
  }

  function manifestPaths() {
    return ['package.json', 'a/package.json', 'b/package.json'].map(file =>
      path.join(cwd, file),
    )
  }

  async function setVersions(version: string) {
    for (const [index, file] of manifestPaths().entries()) {
      await writeFile(
        file,
        JSON.stringify(
          {
            name: ['root', 'pkg-a', 'pkg-b'][index],
            version,
            ...(index === 0
              ? {
                  private: true,
                  workspaces: ['a', 'b'],
                  packageManager: 'npm@10.0.0',
                }
              : {}),
          },
          null,
          2,
        ) + '\n',
      )
    }
  }

  async function fixtureContext() {
    const [projectPkg, ...manifests] = await Promise.all(
      manifestPaths().map(async file =>
        JSON.parse(await readFile(file, 'utf8')),
      ),
    )
    const context = {
      cwd,
      signal: undefined as AbortSignal | undefined,
      config: {
        ...structuredClone(defaultConfig),
        git: {
          ...structuredClone(defaultConfig.git),
          independent: true,
          push: false,
          requireClean: false,
        },
        npm: { ...structuredClone(defaultConfig.npm), confirm: false },
      },
      appData: {
        projectPkg,
        projectPkgJsonPath: manifestPaths()[0],
        workspacePackages: manifests.map((manifest, index) => ({
          manifest,
          manifestPath: manifestPaths()[index + 1],
          rootPath: path.dirname(manifestPaths()[index + 1]),
        })),
        packageManager: 'npm',
      } as AppData,
      step: vi.fn(),
      onCheck: vi.fn(),
      getIncrementVersion:
        vi.fn<
          (
            handler: (args: { retry?: boolean }) => Promise<string>,
            options?: { stage?: number },
          ) => void
        >(),
      getChangelog: vi.fn(),
      onBeforeBumpVersion: vi.fn<LifecycleRegistration>(),
      onBumpVersion: vi.fn<LifecycleRegistration>(),
      onAfterBumpVersion: vi.fn<LifecycleRegistration>(),
      onBeforeRelease: vi.fn<LifecycleRegistration>(),
      onRelease: vi.fn<LifecycleRegistration>(),
      onError: vi.fn<LifecycleRegistration>(),
      onAfterRelease: vi.fn<LifecycleRegistration>(),
    }
    versionPlugin(context as unknown as ReleasePluginContext)
    gitPlugin(context as unknown as ReleasePluginContext)
    return context
  }

  async function bump(context: Awaited<ReturnType<typeof fixtureContext>>) {
    await context.onBeforeBumpVersion.mock.calls[0][0](info)
    await context.onBumpVersion.mock.calls[0][0](info)
    await context.onAfterBumpVersion.mock.calls[0][0](info)
  }

  async function git(...args: string[]) {
    const { stdout } = await execute('git', args, {
      cwd,
      env: {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
      },
    })
    return stdout.trim()
  }
})
