import { run } from '@eljs/utils/cp'
import { gitCommit, gitTag } from '@eljs/utils/git'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultConfig } from '../../../src/default'
import gitPlugin from '../../../src/internal/plugins/git'
import npmPlugin from '../../../src/internal/plugins/npm'
import { extractPublishAccess } from '../../../src/internal/publish-access'
import type {
  AppData,
  ReleasePluginContext,
  ResolvedConfig,
  WorkspacePackageJson,
} from '../../../src/types'
import { AppError } from '../../../src/utils/error'

vi.mock('@eljs/utils/cp', async importOriginal => ({
  ...(await importOriginal<typeof import('@eljs/utils/cp')>()),
  run: vi.fn(async () => ({ stdout: '', stderr: '' })),
}))
vi.mock('@eljs/utils/git', async importOriginal => ({
  ...(await importOriginal<typeof import('@eljs/utils/git')>()),
  gitCommit: vi.fn(async () => undefined),
  gitTag: vi.fn(async () => undefined),
  gitPush: vi.fn(() => {
    throw new Error('Push is forbidden')
  }),
}))

const info = {
  version: '1.1.0',
  isPrerelease: false,
  prereleaseId: null,
  changelog: '',
}
type Handler = (args: typeof info) => void | Promise<void>
type Registration = (handler: Handler, options?: { stage?: number }) => void
const variants = ['npm', 'pnpm', 'yarn-classic', 'yarn-berry', 'bun'] as const

describe('真实清单发布权限与命令边界', () => {
  let cwd = ''
  beforeEach(() => vi.resetAllMocks())
  afterEach(async () => {
    if (cwd) await rm(cwd, { recursive: true, force: true })
  })

  describe.each(variants)('%s', variant => {
    it.each([
      {
        label: '根默认值',
        rootAccess: 'public',
        childAccess: undefined,
        cliArgs: ['--otp', '123456'],
        expected: 'public',
      },
      {
        label: '子包覆盖根默认值',
        rootAccess: 'public',
        childAccess: 'restricted',
        cliArgs: ['--otp', '123456'],
        expected: 'restricted',
      },
      {
        label: 'CLI 覆盖根和子包且重复同值只输出一次',
        rootAccess: 'restricted',
        childAccess: 'restricted',
        cliArgs: ['--access=public', '--otp', '123456', '--access', 'public'],
        expected: 'public',
      },
      {
        label: '未指定时保留原生命令默认值',
        rootAccess: undefined,
        childAccess: undefined,
        cliArgs: ['--otp', '123456'],
        expected: undefined,
      },
    ])('$label', async options => {
      const context = await fixture(variant, options)
      await invoke(context.onCheck)
      await invoke(context.onBeforeBumpVersion)
      await invoke(context.onRelease)
      expect(run).toHaveBeenCalledTimes(1)
      const args = [
        ...(variant === 'yarn-berry' ? ['npm', 'publish'] : ['publish']),
        ...(options.expected ? ['--access', options.expected] : []),
        '--otp',
        '123456',
        ...(variant === 'npm'
          ? ['--dry-run=false', '--usage=false']
          : variant === 'pnpm'
            ? ['--dry-run=false']
            : []),
      ]
      expect(run).toHaveBeenCalledWith(
        context.appData.packageManager,
        args,
        expect.objectContaining({
          cwd: context.appData.workspacePackages[0].rootPath,
        }),
      )
      expect(gitCommit).toHaveBeenCalledTimes(1)
    })
  })

  it.each(['root', 'child'] as const)(
    '无效 %s access 即使被 CLI 覆盖也在所有预检入口拒绝',
    async source => {
      const context = await fixture('npm', {
        rootAccess: 'public',
        childAccess: 'public',
        cliArgs: ['--access=public'],
      })
      for (const value of ['PUBLIC', '', 'private', null, false, 1, {}]) {
        if (source === 'root') {
          const file = path.join(cwd, 'package.json')
          await save(file, {
            name: 'root',
            private: true,
            publishConfig: { access: value },
          })
          context.appData.projectPkg = JSON.parse(await readFile(file, 'utf8'))
        } else {
          const pkg = context.appData.workspacePackages[0]
          await save(pkg.manifestPath, {
            ...pkg.manifest,
            publishConfig: { access: value },
          })
          pkg.manifest = JSON.parse(await readFile(pkg.manifestPath, 'utf8'))
        }
        for (const registration of [
          context.onCheck,
          context.onBeforeBumpVersion,
          context.onRelease,
        ]) {
          await expect(invoke(registration)).rejects.toThrow(
            'access must be public or restricted',
          )
        }
      }
      expect(gitCommit).not.toHaveBeenCalled()
      expect(gitTag).not.toHaveBeenCalled()
      expect(run).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['--access'],
    ['--access='],
    ['--access', 'private'],
    ['--access=PUBLIC'],
    ['--access=public', '--access', 'restricted'],
    ['--access', 'restricted', '--access=public'],
    ['--acc=public'],
    ['--ACCESS=public'],
    ['---access=public'],
    ['--no-access'],
    ['--no-no-access=public'],
  ])('权限参数 %j 在所有预检入口拒绝且无副作用', async (...cliArgs) => {
    const context = await fixture('npm', { cliArgs })
    for (const registration of [
      context.onCheck,
      context.onBeforeBumpVersion,
      context.onRelease,
    ]) {
      await expect(invoke(registration)).rejects.toThrow(/access/)
    }
    expect(gitCommit).not.toHaveBeenCalled()
    expect(gitTag).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it.each([
    ['public', 'restricted'],
    ['public', undefined],
    [undefined, 'public'],
    ['public', 'invalid'],
  ])('Hook 将源 access 从 %s 改为 %s 时在提交前拒绝', async (before, after) => {
    const context = await fixture('npm', { childAccess: before })
    const pkg = context.appData.workspacePackages[0]
    context.onBeforeRelease(
      async () => {
        await save(pkg.manifestPath, {
          ...pkg.manifest,
          publishConfig: { access: after },
        })
        // 同时改写内存，确保复检依据版本预检快照而非可变的当前清单
        pkg.manifest = JSON.parse(await readFile(pkg.manifestPath, 'utf8'))
      },
      { stage: 10000 },
    )
    await invoke(context.onBeforeBumpVersion)
    await invoke(context.onBeforeRelease)
    await expect(invoke(context.onRelease)).rejects.toThrow(/access/)
    expect(gitCommit).not.toHaveBeenCalled()
    expect(gitTag).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it.each(['root', 'CLI'] as const)(
    '版本预检后修改 %s 默认权限不能改变已确定的发布权限',
    async source => {
      const context = await fixture('npm', {
        rootAccess: 'public',
        cliArgs: source === 'CLI' ? ['--access=public'] : [],
      })
      await invoke(context.onBeforeBumpVersion)
      if (source === 'root') {
        context.appData.projectPkg.publishConfig = { access: 'restricted' }
      } else {
        context.config.npm.publishArgs = ['--access=restricted']
      }
      await expect(invoke(context.onRelease)).rejects.toThrow(/access/)
      expect(gitCommit).not.toHaveBeenCalled()
      expect(run).not.toHaveBeenCalled()
    },
  )

  it('子包覆盖根默认权限时，根默认值变化不影响发布', async () => {
    const context = await fixture('npm', {
      rootAccess: 'public',
      childAccess: 'public',
    })
    await invoke(context.onBeforeBumpVersion)
    context.appData.projectPkg.publishConfig = { access: 'restricted' }
    await invoke(context.onRelease)
    expect(run).toHaveBeenCalledWith(
      'npm',
      ['publish', '--access', 'public', '--dry-run=false', '--usage=false'],
      expect.anything(),
    )
  })

  it.each(['Hook', 'Git commit'] as const)(
    '%s 只改写磁盘根权限时阻止首个发布命令',
    async boundary => {
      const context = await fixture('npm', { rootAccess: 'public' })
      const changeRoot = async () => {
        await save(context.appData.projectPkgJsonPath, {
          ...context.appData.projectPkg,
          publishConfig: { access: 'restricted' },
        })
      }
      if (boundary === 'Hook') {
        context.onBeforeRelease(changeRoot)
      } else {
        vi.mocked(gitCommit).mockImplementationOnce(changeRoot)
      }
      await invoke(context.onBeforeBumpVersion)
      await invoke(context.onBeforeRelease)
      await expect(invoke(context.onRelease)).rejects.toThrow(/access/)
      expect(context.appData.projectPkg.publishConfig?.access).toBe('public')
      expect(gitCommit).toHaveBeenCalledTimes(boundary === 'Hook' ? 0 : 1)
      expect(run).not.toHaveBeenCalled()
    },
  )

  it.each(['child', 'CLI'] as const)(
    '%s 覆盖默认权限时允许磁盘根权限变化',
    async source => {
      const context = await fixture('npm', {
        rootAccess: 'public',
        childAccess: source === 'child' ? 'public' : undefined,
        cliArgs: source === 'CLI' ? ['--access=public'] : [],
      })
      await invoke(context.onBeforeBumpVersion)
      await save(context.appData.projectPkgJsonPath, {
        ...context.appData.projectPkg,
        publishConfig: { access: 'restricted' },
      })
      await invoke(context.onRelease)
      expect(run).toHaveBeenCalledWith(
        'npm',
        ['publish', '--access', 'public', '--dry-run=false', '--usage=false'],
        expect.anything(),
      )
    },
  )

  it.each(['restricted', 'invalid', null])(
    'Hook 生成的 pnpm dist access %s 在提交前拒绝',
    async access => {
      const context = await fixture('pnpm', {
        childAccess: 'public',
        directory: 'dist',
      })
      context.onBeforeRelease(
        async () => {
          await distManifest(context, access)
        },
        { stage: 10000 },
      )
      await invoke(context.onBeforeBumpVersion)
      await invoke(context.onBeforeRelease)
      await expect(invoke(context.onRelease)).rejects.toThrow(/access/)
      expect(gitCommit).not.toHaveBeenCalled()
      expect(gitTag).not.toHaveBeenCalled()
      expect(run).not.toHaveBeenCalled()
    },
  )

  it.each([
    { rootAccess: 'public', childAccess: 'restricted', expected: 'restricted' },
    { rootAccess: 'public', childAccess: undefined, expected: 'public' },
  ])('pnpm dist 缺失 access 时继承源清单有效值 $expected', async options => {
    const context = await fixture('pnpm', { ...options, directory: 'dist' })
    await invoke(context.onBeforeBumpVersion)
    await distManifest(context)
    await invoke(context.onRelease)
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith(
      'pnpm',
      ['publish', '--access', options.expected, '--dry-run=false'],
      expect.objectContaining({
        cwd: context.appData.workspacePackages[0].rootPath,
      }),
    )
  })

  it('CLI 有效值覆盖 pnpm dist 的不同合法声明', async () => {
    const context = await fixture('pnpm', {
      rootAccess: 'restricted',
      childAccess: 'restricted',
      directory: 'dist',
      cliArgs: ['--access=public'],
    })
    await invoke(context.onBeforeBumpVersion)
    await distManifest(context, 'restricted')
    await invoke(context.onRelease)
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith(
      'pnpm',
      ['publish', '--access', 'public', '--dry-run=false'],
      expect.anything(),
    )
  })

  it.each(['source', 'dist'] as const)(
    'Git 提交阶段改写 %s access 后在首个发布命令前拒绝',
    async location => {
      const context = await fixture('pnpm', {
        childAccess: 'public',
        directory: location === 'dist' ? 'dist' : undefined,
      })
      if (location === 'dist') await distManifest(context, 'public')
      const pkg = context.appData.workspacePackages[0]
      await invoke(context.onBeforeBumpVersion)
      vi.mocked(gitCommit).mockImplementationOnce(async () => {
        await save(
          location === 'dist'
            ? path.join(pkg.rootPath, 'dist/package.json')
            : pkg.manifestPath,
          { ...pkg.manifest, publishConfig: { access: 'restricted' } },
        )
      })
      await expect(invoke(context.onRelease)).rejects.toThrow(/access/)
      expect(gitCommit).toHaveBeenCalledTimes(1)
      expect(run).not.toHaveBeenCalled()
    },
  )

  it.each(['source', 'dist', 'root'] as const)(
    '前一个包发布时改写后续 %s access，停止后续命令并保留进度',
    async location => {
      const context = await fixture('pnpm', { rootAccess: 'public' })
      const rootPath = path.join(cwd, 'second')
      await mkdir(rootPath)
      const second = {
        rootPath,
        manifestPath: path.join(rootPath, 'package.json'),
        manifest: {
          name: 'second',
          version: info.version,
          dependencies: { app: '^1.1.0' },
          publishConfig: {
            access: location === 'root' ? undefined : 'public',
            ...(location === 'dist' ? { directory: 'dist' } : {}),
          },
        } as WorkspacePackageJson,
      }
      context.appData.workspacePackages.push(second)
      await save(second.manifestPath, second.manifest)
      const effectivePath =
        location === 'root'
          ? context.appData.projectPkgJsonPath
          : location === 'dist'
            ? path.join(rootPath, 'dist/package.json')
            : second.manifestPath
      if (location === 'dist') {
        await mkdir(path.dirname(effectivePath))
        await save(effectivePath, second.manifest)
      }
      await invoke(context.onBeforeBumpVersion)
      vi.mocked(run).mockImplementationOnce((async () => {
        await save(effectivePath, {
          ...(location === 'root'
            ? context.appData.projectPkg
            : second.manifest),
          publishConfig: { access: 'restricted' },
        })
        return { stdout: '', stderr: '' }
      }) as unknown as typeof run)
      await expect(invoke(context.onRelease)).rejects.toMatchObject({
        message: expect.stringContaining('Release publish preflight failed'),
        cause: {
          code: 'EPUBLISH_PREFLIGHT',
          message: expect.stringContaining('publish access'),
        },
        details: {
          failedPackage: 'second',
          publishedPackages: ['app'],
          unpublishedPackages: ['second'],
        },
      })
      expect(run).toHaveBeenCalledTimes(1)
      expect(run).toHaveBeenCalledWith(
        'pnpm',
        ['publish', '--access', 'public', '--dry-run=false'],
        expect.objectContaining({
          cwd: context.appData.workspacePackages[0].rootPath,
        }),
      )
    },
  )

  it('命令抛出任意 AppError 时不透传消息或误标为内置预检失败', async () => {
    const context = await fixture('npm', { childAccess: 'public' })
    await invoke(context.onBeforeBumpVersion)
    vi.mocked(run).mockRejectedValueOnce(new AppError('private-token'))
    const error = await invoke(context.onRelease).catch(value => value)
    expect(error).toMatchObject({
      cause: { message: 'Release operation failed' },
      details: {
        failedPackage: 'app',
        publishedPackages: [],
        unpublishedPackages: ['app'],
      },
    })
    expect(error.message).not.toContain('private-token')
    expect(error.cause).not.toHaveProperty('code')
    expect(run).toHaveBeenCalledTimes(1)
  })

  async function fixture(
    variant: (typeof variants)[number] = 'npm',
    options: {
      rootAccess?: unknown
      childAccess?: unknown
      cliArgs?: string[]
      directory?: string
    } = {},
  ) {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-publish-access-'))
    const projectPath = path.join(cwd, 'package.json')
    await save(projectPath, {
      name: 'root',
      private: true,
      publishConfig: { access: options.rootAccess },
    })
    const rootPath = path.join(cwd, 'app')
    await mkdir(rootPath)
    const manifestPath = path.join(rootPath, 'package.json')
    await save(manifestPath, {
      name: 'app',
      version: info.version,
      publishConfig: {
        access: options.childAccess,
        directory: options.directory,
      },
    })
    const context = {
      cwd,
      config: {
        ...structuredClone(defaultConfig),
        npm: {
          ...defaultConfig.npm,
          requireOwner: false,
          publishArgs: options.cliArgs,
        },
        git: {
          ...defaultConfig.git,
          push: false,
          requireClean: false,
          changelog: false,
        },
      } as ResolvedConfig,
      appData: {
        projectPkgJsonPath: projectPath,
        projectPkg: JSON.parse(await readFile(projectPath, 'utf8')),
        workspacePackages: [
          {
            manifest: JSON.parse(await readFile(manifestPath, 'utf8')),
            rootPath,
            manifestPath,
          },
        ],
        packageManager: variant.startsWith('yarn') ? 'yarn' : variant,
        packageManagerVariant: variant,
        branch: 'main',
      } as AppData,
      step: vi.fn(),
      onCheck: vi.fn<Registration>(),
      getChangelog: vi.fn<Registration>(),
      onBeforeBumpVersion: vi.fn<Registration>(),
      onBeforeRelease: vi.fn<Registration>(),
      onRelease: vi.fn<Registration>(),
      onError: vi.fn(),
      onAfterRelease: vi.fn(),
    }
    npmPlugin(context as unknown as ReleasePluginContext)
    gitPlugin(context as unknown as ReleasePluginContext)
    return context
  }

  async function distManifest(
    context: Awaited<ReturnType<typeof fixture>>,
    access?: unknown,
  ) {
    const pkg = context.appData.workspacePackages[0]
    await mkdir(path.join(pkg.rootPath, 'dist'), { recursive: true })
    await save(path.join(pkg.rootPath, 'dist/package.json'), {
      name: pkg.manifest.name,
      version: info.version,
      publishConfig: { access },
    })
  }
})

describe('发布权限参数提取合同', () => {
  it('同值重复归一化并保留其他参数顺序，不修改输入', () => {
    const args = Object.freeze([
      '--otp',
      '123456',
      '--access=restricted',
      '--tag=next',
      '--access',
      'restricted',
      '--provenance',
    ])
    expect(extractPublishAccess(args)).toEqual({
      access: 'restricted',
      args: ['--otp', '123456', '--tag=next', '--provenance'],
    })
    expect(args).toHaveLength(7)
    expect(extractPublishAccess(['--provenance'])).toEqual({
      access: undefined,
      args: ['--provenance'],
    })
  })

  it.each([
    '-a=public',
    '--a=public',
    '--acc=public',
    '--ACCESS=public',
    '---access=public',
    '--no-access=public',
    '--no-no-access=public',
  ])('拒绝非规范权限选项 %s', arg => {
    expect(() => extractPublishAccess([arg])).toThrow('full --access')
  })
})

async function save(file: string, value: unknown) {
  await writeFile(file, JSON.stringify(value))
}

async function invoke(registration: ReturnType<typeof vi.fn<Registration>>) {
  for (const [handler] of [...registration.mock.calls].sort(
    (a, b) => (a[1]?.stage ?? 0) - (b[1]?.stage ?? 0),
  ))
    await handler(info)
}
