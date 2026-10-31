import { run } from '@eljs/utils/cp'
import { gitCommit } from '@eljs/utils/git'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultConfig } from '../../../src/default'
import { definePlugin } from '../../../src/define'
import gitPlugin from '../../../src/internal/plugins/git'
import npmPlugin from '../../../src/internal/plugins/npm'
import { inspectPublishPlan } from '../../../src/internal/publish-plan'
import type {
  AppData,
  ReleasePluginContext,
  ResolvedConfig,
  WorkspacePackageJson,
} from '../../../src/types'

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

describe('真实发布目录与 Hook 的只读边界', () => {
  let cwd = ''
  beforeEach(() => vi.clearAllMocks())
  afterEach(async () => {
    if (cwd) await rm(cwd, { recursive: true, force: true })
  })

  it.each(['name', 'version', 'private'] as const)(
    '全部 onBeforeRelease 完成后拒绝源清单 %s 偏离，先于 Git 提交',
    async field => {
      const context = await fixture()
      npmPlugin(context as unknown as ReleasePluginContext)
      gitPlugin(context as unknown as ReleasePluginContext)
      definePlugin(api => {
        api.onBeforeRelease(
          async () => {
            const pkg = context.appData.workspacePackages[0]
            await save(pkg.manifestPath, {
              ...pkg.manifest,
              [field]: field === 'private' ? true : 'changed',
            })
          },
          { stage: 10000 },
        )
      })(context as unknown as ReleasePluginContext)
      await invoke(context.onBeforeBumpVersion)
      await invoke(context.onBeforeRelease)
      await expect(invoke(context.onRelease)).rejects.toThrow(
        'manifest identity',
      )
      expect(gitCommit).not.toHaveBeenCalled()
      expect(run).not.toHaveBeenCalled()
    },
  )

  it.each(['name', 'version'] as const)(
    'Hook 可生成 pnpm 发布目录，但产物 %s 偏离必须在提交前拒绝',
    async field => {
      const context = await fixture('pnpm', {
        publishConfig: { directory: 'dist' },
      })
      npmPlugin(context as unknown as ReleasePluginContext)
      gitPlugin(context as unknown as ReleasePluginContext)
      const pkg = context.appData.workspacePackages[0]
      context.onBeforeRelease(
        async () => {
          await mkdir(path.join(pkg.rootPath, 'dist'))
          await save(path.join(pkg.rootPath, 'dist/package.json'), {
            name: field === 'name' ? 'wrong-package' : pkg.manifest.name,
            version: field === 'version' ? '1.0.0' : info.version,
          })
        },
        { stage: 10000 },
      )
      await invoke(context.onBeforeBumpVersion)
      await invoke(context.onBeforeRelease)
      await expect(invoke(context.onRelease)).rejects.toThrow(
        'manifest identity',
      )
      expect(gitCommit).not.toHaveBeenCalled()
      expect(run).not.toHaveBeenCalled()

      await save(path.join(pkg.rootPath, 'dist/package.json'), pkg.manifest)
      await invoke(context.onRelease)
      expect(gitCommit).toHaveBeenCalledTimes(1)
      expect(run).toHaveBeenCalledWith(
        'pnpm',
        expect.arrayContaining(['publish']),
        expect.objectContaining({ cwd: pkg.rootPath }),
      )
    },
  )

  it.each(['npm', 'yarn-classic', 'yarn-berry', 'bun'] as const)(
    '%s 使用包根清单，不为忽略的 directory 新增 pack 或脚本执行',
    async variant => {
      const context = await fixture(
        variant === 'yarn-classic' || variant === 'yarn-berry'
          ? 'yarn'
          : variant,
        { publishConfig: { directory: 'missing-dist' } },
      )
      context.appData.packageManagerVariant = variant
      npmPlugin(context as unknown as ReleasePluginContext)
      await invoke(context.onBeforeBumpVersion)
      await invoke(context.onRelease)
      expect(run).toHaveBeenCalledTimes(1)
      expect(run).toHaveBeenCalledWith(
        context.appData.packageManager,
        expect.arrayContaining(
          variant === 'yarn-berry' ? ['npm', 'publish'] : ['publish'],
        ),
        expect.objectContaining({
          cwd: context.appData.workspacePackages[0].rootPath,
        }),
      )
    },
  )

  it.each(['npm', 'pnpm', 'yarn-classic', 'yarn-berry', 'bun'] as const)(
    '%s 在所有预检入口拒绝提前退出参数及规范化绕过',
    async variant => {
      const context = await fixture(
        variant.startsWith('yarn')
          ? 'yarn'
          : (variant as 'npm' | 'pnpm' | 'bun'),
      )
      context.appData.packageManagerVariant = variant
      npmPlugin(context as unknown as ReleasePluginContext)
      gitPlugin(context as unknown as ReleasePluginContext)
      for (const arg of [
        '--help',
        '--usage',
        '--version',
        '--versions',
        '-h',
        '-v',
        '-V',
        '--he',
        '--usa',
        '--ver',
        '--help=false',
        '--usage=true',
        '--version=false',
        '---HELP',
        '---USAGE=true',
        '--no-no-help',
        '--no-usage',
        '--no-version',
        '--no-versions=false',
      ]) {
        context.config.npm.publishArgs = [arg]
        for (const dryRun of [false, true]) {
          context.config.dryRun = dryRun
          await expect(invoke(context.onCheck)).rejects.toThrow(
            'cannot replace publishing',
          )
          await expect(invoke(context.onBeforeBumpVersion)).rejects.toThrow(
            'cannot replace publishing',
          )
          await expect(invoke(context.onRelease)).rejects.toThrow(
            'cannot replace publishing',
          )
        }
      }
      expect(gitCommit).not.toHaveBeenCalled()
      expect(run).not.toHaveBeenCalled()
    },
  )

  it.each(['npm', 'pnpm'] as const)(
    '%s 本地预览和帮助可退出成功，固定发布模式进入发布入口并失败',
    async packageManager => {
      const { run: runCommand } =
        await vi.importActual<typeof import('@eljs/utils/cp')>('@eljs/utils/cp')
      const context = await fixture(packageManager)
      const userConfig = path.join(cwd, 'empty-user.npmrc')
      const globalConfig = path.join(cwd, 'empty-global.npmrc')
      await writeFile(userConfig, '')
      await writeFile(globalConfig, '')
      context.appData.registry = 'http://127.0.0.1:1'
      context.config.npm.publishArgs = ['--ignore-scripts']
      if (packageManager === 'pnpm')
        context.config.npm.publishArgs.push('--no-git-checks')
      npmPlugin(context as unknown as ReleasePluginContext)
      await invoke(context.onBeforeBumpVersion)
      await invoke(context.onRelease)
      const [, publishArgs, options] = vi.mocked(run).mock.calls[0]
      expect(Array.isArray(publishArgs)).toBe(true)
      const args = publishArgs as string[]
      const rootPath = context.appData.workspacePackages[0].rootPath
      // 不提供认证且 registry 固定到无服务的回环地址，npm 鉴权失败或 pnpm 连接失败均不会上传
      const env = {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            ([key]) => !/^npm_config_/i.test(key),
          ),
        ),
        npm_config_userconfig: userConfig,
        npm_config_globalconfig: globalConfig,
        npm_config_offline: 'true',
        npm_config_fetch_retries: '0',
      }
      const preview = await runCommand(
        packageManager,
        [
          ...args.filter(
            arg => !['--dry-run=false', '--usage=false'].includes(arg),
          ),
          '--dry-run',
        ],
        { cwd: rootPath, env, reject: false, timeout: 5000 },
      )
      expect(preview.exitCode, preview.stderr).toBe(0)
      expect(`${preview.stdout}${preview.stderr}`).toMatch(/dry.run/i)
      const help = await runCommand(packageManager, ['publish', '--help'], {
        cwd: rootPath,
        env,
        reject: false,
        timeout: 5000,
      })
      expect(help.exitCode, help.stderr).toBe(0)
      expect(help.stdout).toContain('Usage:')
      for (const inherited of [
        { npm_config_dry_run: 'true' },
        { npm_config_usage: 'true' },
        {},
      ]) {
        await writeFile(
          path.join(rootPath, '.npmrc'),
          Object.keys(inherited).length ? '' : 'dry-run=true\nusage=true\n',
        )
        const actual = await runCommand(packageManager, args, {
          cwd: rootPath,
          env: { ...env, ...inherited, ...options?.env },
          reject: false,
          timeout: 5000,
        })
        expect(actual.exitCode, `${actual.stdout}${actual.stderr}`).not.toBe(0)
        expect(`${actual.stdout}${actual.stderr}`).toMatch(
          packageManager === 'npm'
            ? /ENEEDAUTH/
            : /publish request failed[\s\S]*127\.0\.0\.1:1/i,
        )
        expect(`${actual.stdout}${actual.stderr}`).not.toMatch(
          /unexpected|unknown option/i,
        )
      }
    },
    30_000,
  )

  it('pnpm 有效发布清单重建依赖顺序，并拒绝有效清单的 private 与循环依赖', async () => {
    const context = await fixture('pnpm', {
      publishConfig: { directory: 'dist' },
    })
    const appData = context.appData
    const app = appData.workspacePackages[0]
    const coreRoot = path.join(cwd, 'core')
    await mkdir(coreRoot)
    const core = {
      rootPath: coreRoot,
      manifestPath: path.join(coreRoot, 'package.json'),
      manifest: { name: 'core', version: info.version },
    }
    appData.workspacePackages.push(core)
    await save(core.manifestPath, core.manifest)
    await mkdir(path.join(app.rootPath, 'dist'))
    const effectivePath = path.join(app.rootPath, 'dist/package.json')
    await save(effectivePath, {
      ...app.manifest,
      dependencies: { alias: 'workspace:core@*' },
    })
    const expected = structuredClone(appData.workspacePackages)
    expect(
      (await inspectPublishPlan(appData, expected, info.version)).map(
        pkg => pkg.name,
      ),
    ).toEqual(['core', 'app'])
    await save(effectivePath, { ...app.manifest, private: true })
    await expect(
      inspectPublishPlan(appData, expected, info.version),
    ).rejects.toThrow('manifest identity')
    await save(effectivePath, {
      ...app.manifest,
      dependencies: { alias: 'workspace:core@*' },
    })
    await save(core.manifestPath, {
      ...core.manifest,
      dependencies: { alias: 'workspace:app@*' },
    })
    await expect(
      inspectPublishPlan(appData, expected, info.version),
    ).rejects.toThrow('circular runtime dependency')
  })

  it('前一个包的发布脚本改写后续产物时停止并保留恢复进度', async () => {
    const context = await fixture()
    const secondRoot = path.join(cwd, 'second')
    await mkdir(secondRoot)
    const second = {
      rootPath: secondRoot,
      manifestPath: path.join(secondRoot, 'package.json'),
      manifest: { name: 'second', version: info.version },
    }
    context.appData.workspacePackages.push(second)
    await save(second.manifestPath, second.manifest)
    npmPlugin(context as unknown as ReleasePluginContext)
    await invoke(context.onBeforeBumpVersion)
    vi.mocked(run).mockImplementationOnce((() =>
      (async () => {
        await save(second.manifestPath, {
          ...second.manifest,
          version: '0.0.1',
        })
        return { stdout: '', stderr: '' } as Awaited<ReturnType<typeof run>>
      })()) as unknown as typeof run)
    await expect(invoke(context.onRelease)).rejects.toMatchObject({
      details: {
        publishedPackages: ['app'],
        unpublishedPackages: ['second'],
        failedPackage: 'second',
      },
    })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it.each([
    '--dry-run',
    '--dry-run=true',
    '--dry-run=false',
    '--no-dry-run',
    '---DRY_RUN=true',
    '--no-no-dry-run',
    '--dryRun=true',
    '--dry',
    '--dry-r',
    '--dry-ru=false',
    '--dr',
    '--d',
    '-d',
  ])('额外预览参数 %s 在全部入口拒绝且不启动命令', async arg => {
    const context = await fixture()
    context.config.npm.publishArgs = [arg]
    npmPlugin(context as unknown as ReleasePluginContext)
    gitPlugin(context as unknown as ReleasePluginContext)
    for (const dryRun of [false, true]) {
      context.config.dryRun = dryRun
      await expect(invoke(context.onCheck)).rejects.toThrow('top-level dryRun')
      await expect(invoke(context.onBeforeBumpVersion)).rejects.toThrow(
        'top-level dryRun',
      )
      await expect(invoke(context.onRelease)).rejects.toThrow(
        'top-level dryRun',
      )
    }
    expect(gitCommit).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it.each(['npm', 'pnpm', 'yarn-classic', 'yarn-berry', 'bun'] as const)(
    '%s 按真实 registry 优先级复检 Hook 改写的清单',
    async variant => {
      const context = await fixture(
        variant.startsWith('yarn')
          ? 'yarn'
          : (variant as 'npm' | 'pnpm' | 'bun'),
      )
      context.appData.packageManagerVariant = variant
      context.appData.registry = 'https://fixed.invalid/'
      npmPlugin(context as unknown as ReleasePluginContext)
      gitPlugin(context as unknown as ReleasePluginContext)
      await invoke(context.onBeforeBumpVersion)
      const pkg = context.appData.workspacePackages[0]
      await save(pkg.manifestPath, {
        ...pkg.manifest,
        publishConfig: { registry: 'https://user:secret@other.invalid' },
      })
      if (variant === 'yarn-berry') {
        const error = await invoke(context.onRelease).catch(value => value)
        expect(error.message).toContain('effective publishConfig.registry')
        expect(error.message).not.toContain('secret')
        expect(gitCommit).not.toHaveBeenCalled()
        expect(run).not.toHaveBeenCalled()
        await save(pkg.manifestPath, {
          ...pkg.manifest,
          publishConfig: { registry: 'https://fixed.invalid' },
        })
      }
      await invoke(context.onRelease)
      expect(run).toHaveBeenCalledTimes(1)
    },
  )

  it('没有固定 registry 时新增产物地址必须在提交前拒绝', async () => {
    const context = await fixture('pnpm', {
      publishConfig: { directory: 'dist' },
    })
    const pkg = context.appData.workspacePackages[0]
    await mkdir(path.join(pkg.rootPath, 'dist'))
    await save(path.join(pkg.rootPath, 'dist/package.json'), {
      ...pkg.manifest,
      publishConfig: { registry: 'https://unexpected.invalid' },
    })
    npmPlugin(context as unknown as ReleasePluginContext)
    gitPlugin(context as unknown as ReleasePluginContext)
    await invoke(context.onBeforeBumpVersion)
    await expect(invoke(context.onRelease)).rejects.toThrow(
      'effective publishConfig.registry',
    )
    expect(gitCommit).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it('固定 registry 在预检后不能被 Hook 修改', async () => {
    const context = await fixture()
    context.appData.registry = 'https://fixed.invalid'
    npmPlugin(context as unknown as ReleasePluginContext)
    gitPlugin(context as unknown as ReleasePluginContext)
    await invoke(context.onBeforeBumpVersion)
    context.appData.registry = 'https://changed.invalid'
    await expect(invoke(context.onRelease)).rejects.toThrow('registry changed')
    expect(gitCommit).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it('pnpm 产物 registry 被固定 CLI 地址覆盖时允许发布', async () => {
    const context = await fixture('pnpm', {
      publishConfig: { directory: 'dist' },
    })
    context.appData.registry = 'https://fixed.invalid'
    const pkg = context.appData.workspacePackages[0]
    await mkdir(path.join(pkg.rootPath, 'dist'))
    await save(path.join(pkg.rootPath, 'dist/package.json'), {
      ...pkg.manifest,
      publishConfig: { registry: 'https://overridden.invalid' },
    })
    npmPlugin(context as unknown as ReleasePluginContext)
    await invoke(context.onBeforeBumpVersion)
    await invoke(context.onRelease)
    expect(run).toHaveBeenCalledWith(
      'pnpm',
      ['publish', '--registry', 'https://fixed.invalid', '--dry-run=false'],
      expect.objectContaining({ cwd: pkg.rootPath }),
    )
  })

  it('逐包发布前复检 Yarn Berry 的后续清单 registry 并保留进度', async () => {
    const context = await fixture('yarn')
    context.appData.packageManagerVariant = 'yarn-berry'
    context.appData.registry = 'https://fixed.invalid'
    const rootPath = path.join(cwd, 'second')
    await mkdir(rootPath)
    const second = {
      rootPath,
      manifestPath: path.join(rootPath, 'package.json'),
      manifest: { name: 'second', version: info.version },
    }
    context.appData.workspacePackages.push(second)
    await save(second.manifestPath, second.manifest)
    npmPlugin(context as unknown as ReleasePluginContext)
    await invoke(context.onBeforeBumpVersion)
    vi.mocked(run).mockImplementationOnce((async () => {
      await save(second.manifestPath, {
        ...second.manifest,
        publishConfig: { registry: 'https://other.invalid' },
      })
      return { stdout: '', stderr: '' }
    }) as unknown as typeof run)
    await expect(invoke(context.onRelease)).rejects.toMatchObject({
      details: {
        publishedPackages: ['app'],
        unpublishedPackages: ['second'],
      },
    })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['dependencies', 'workspace:^9.0.0'],
    ['optionalDependencies', 'workspace:core@~9.0.0'],
    ['peerDependencies', 'not-a-range'],
    ['devDependencies', '^9.0.0'],
    ['dependencies', 'workspace:core@broken'],
    ['optionalDependencies', ''],
    ['dependencies', '^'],
  ])('产物内部 %s 的 %s 在提交前拒绝', async (field, range) => {
    const context = await fixture('pnpm', {
      publishConfig: { directory: 'dist' },
    })
    const app = context.appData.workspacePackages[0]
    const rootPath = path.join(cwd, 'core')
    await mkdir(rootPath)
    const core = {
      rootPath,
      manifestPath: path.join(rootPath, 'package.json'),
      manifest: { name: 'core', version: info.version },
    }
    context.appData.workspacePackages.push(core)
    await save(core.manifestPath, core.manifest)
    await mkdir(path.join(app.rootPath, 'dist'))
    await save(path.join(app.rootPath, 'dist/package.json'), {
      ...app.manifest,
      [field]: { core: range },
    })
    npmPlugin(context as unknown as ReleasePluginContext)
    gitPlugin(context as unknown as ReleasePluginContext)
    await invoke(context.onBeforeBumpVersion)
    await expect(invoke(context.onRelease)).rejects.toThrow(
      /internal dependency range|Invalid workspace protocol/,
    )
    expect(gitCommit).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it.each([
    'workspace:*',
    'workspace:^',
    'workspace:~',
    'workspace:core@^1.0.0',
    '^1.0.0',
    '*',
    'npm:external-core@^9.0.0',
    'file:../external-core',
    'link:../external-core',
    'git+https://example.invalid/core.git#main',
    'https://example.invalid/core.tgz',
    'github:org/core',
    'org/core#main',
  ])('有效产物内部范围或外部协议 %s 保留合同', async range => {
    const context = await fixture('pnpm', {
      publishConfig: { directory: 'dist' },
    })
    const app = context.appData.workspacePackages[0]
    const rootPath = path.join(cwd, 'core')
    await mkdir(rootPath)
    const core = {
      rootPath,
      manifestPath: path.join(rootPath, 'package.json'),
      manifest: { name: 'core', version: info.version },
    }
    context.appData.workspacePackages.push(core)
    await save(core.manifestPath, core.manifest)
    await mkdir(path.join(app.rootPath, 'dist'))
    await save(path.join(app.rootPath, 'dist/package.json'), {
      ...app.manifest,
      dependencies: { core: range },
    })
    await expect(
      inspectPublishPlan(
        context.appData,
        structuredClone(context.appData.workspacePackages),
        info.version,
      ),
    ).resolves.toHaveLength(2)
    expect(run).not.toHaveBeenCalled()
  })

  it.each([
    ['*', true],
    ['workspace:^', true],
    ['1.1.0-beta.1', true],
    ['workspace:core@^1.1.0-beta.0', true],
    ['^1.0.0', false],
    ['workspace:^1.0.0', false],
  ] as const)('预发布产物范围 %s', async (range, valid) => {
    const version = '1.1.0-beta.1'
    const context = await fixture('pnpm', {
      version,
      publishConfig: { directory: 'dist' },
    })
    const app = context.appData.workspacePackages[0]
    const rootPath = path.join(cwd, 'core')
    await mkdir(rootPath)
    const core = {
      rootPath,
      manifestPath: path.join(rootPath, 'package.json'),
      manifest: { name: 'core', version },
    }
    context.appData.workspacePackages.push(core)
    await save(core.manifestPath, core.manifest)
    await mkdir(path.join(app.rootPath, 'dist'))
    await save(path.join(app.rootPath, 'dist/package.json'), {
      ...app.manifest,
      dependencies: { core: range },
    })
    const result = inspectPublishPlan(
      context.appData,
      structuredClone(context.appData.workspacePackages),
      version,
    )
    if (valid) await expect(result).resolves.toHaveLength(2)
    else await expect(result).rejects.toThrow('internal dependency range')
    expect(run).not.toHaveBeenCalled()
  })

  it.each([
    ['^0.5.0', true],
    ['workspace:^0.5.0', true],
    ['workspace:^1.0.0', false],
    ['invalid', false],
  ] as const)('private 目标产物范围 %s', async (range, valid) => {
    const context = await fixture('pnpm', {
      publishConfig: { directory: 'dist' },
    })
    const app = context.appData.workspacePackages[0]
    const rootPath = path.join(cwd, 'core')
    await mkdir(rootPath)
    const core = {
      rootPath,
      manifestPath: path.join(rootPath, 'package.json'),
      manifest: { name: 'core', version: '0.5.0', private: true },
    }
    context.appData.workspacePackages.push(core)
    await save(core.manifestPath, core.manifest)
    await mkdir(path.join(app.rootPath, 'dist'))
    await save(path.join(app.rootPath, 'dist/package.json'), {
      ...app.manifest,
      devDependencies: { core: range },
      peerDependencies: { core: range },
    })
    const result = inspectPublishPlan(
      context.appData,
      structuredClone(context.appData.workspacePackages),
      info.version,
    )
    if (valid) await expect(result).resolves.toHaveLength(1)
    else await expect(result).rejects.toThrow('internal dependency range')
    expect(run).not.toHaveBeenCalled()
  })

  it.each([
    ['--registry', 'https://other.invalid'],
    ['--registry=https://other.invalid'],
    ['--reg=https://other.invalid'],
    ['--regi', 'https://other.invalid'],
    ['--REGISTRY=https://other.invalid'],
    ['--@scope:registry=https://other.invalid'],
    ['--npm-publish-registry=https://other.invalid'],
    ['--registry_url=https://other.invalid'],
    ['--no-registry'],
    ['---registry=https://other.invalid'],
    ['--no-no-registry=https://other.invalid'],
    ['--userconfig', '/private-secret.npmrc'],
    ['--userconfig=/private-secret.npmrc'],
    ['--userconf=/private-secret.npmrc'],
    ['--userc=/private-secret.npmrc'],
    ['--globalconfig=/private-secret.npmrc'],
    ['--globalconf=/private-secret.npmrc'],
    ['--user_config=/private-secret.npmrc'],
    ['--use-yarnrc=/private-secret.yarnrc'],
    ['--config.@scope:registry=https://other.invalid'],
    ['--config.registry=https://other.invalid'],
    ['--config.userconfig=/private-secret.npmrc'],
    ['--config=/private-secret.npmrc'],
    ['--scope=@other'],
    ['--scop=@other'],
    ['--sco=@other'],
    ['--global'],
    ['-g'],
  ])('registry 覆盖参数 %j 在预检拒绝且无副作用', async (...args) => {
    const context = await fixture()
    context.config.npm.publishArgs = args
    npmPlugin(context as unknown as ReleasePluginContext)
    gitPlugin(context as unknown as ReleasePluginContext)
    await expect(invoke(context.onCheck)).rejects.toThrow('npm.registry')
    await expect(invoke(context.onBeforeBumpVersion)).rejects.toThrow(
      'npm.registry',
    )
    await expect(invoke(context.onRelease)).rejects.toThrow('npm.registry')
    expect(gitCommit).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it('拒绝参数时不回显配置值中的凭据', async () => {
    const context = await fixture()
    context.config.npm.publishArgs = [
      '--config.@scope:registry=https://user:secret-token@other.invalid',
    ]
    npmPlugin(context as unknown as ReleasePluginContext)
    const error = await invoke(context.onCheck).catch(value => value)
    expect(error.message).toContain('npm.registry')
    expect(error.message).not.toContain('secret-token')
    expect(error.message).not.toContain('user:')
    expect(run).not.toHaveBeenCalled()
  })

  it('其他未知等号配置仍放行并保留配置的 registry', async () => {
    const context = await fixture()
    context.config.npm.publishArgs = ['--fetch-retries=3']
    context.appData.registry = 'https://expected.invalid'
    npmPlugin(context as unknown as ReleasePluginContext)
    await invoke(context.onBeforeBumpVersion)
    await invoke(context.onRelease)
    expect(run).toHaveBeenCalledWith(
      'npm',
      [
        'publish',
        '--registry',
        'https://expected.invalid',
        '--fetch-retries=3',
        '--dry-run=false',
        '--usage=false',
      ],
      expect.anything(),
    )
  })

  it('npm 的小写 -f 仍按 force 参数透传', async () => {
    const context = await fixture()
    context.config.npm.publishArgs = [
      '-f',
      '--access',
      'public',
      '--fetch-retries=3',
    ]
    npmPlugin(context as unknown as ReleasePluginContext)
    await invoke(context.onBeforeBumpVersion)
    await invoke(context.onRelease)
    expect(run).toHaveBeenCalledWith(
      'npm',
      [
        'publish',
        '-f',
        '--access',
        'public',
        '--fetch-retries=3',
        '--dry-run=false',
        '--usage=false',
      ],
      expect.anything(),
    )
  })

  it.each([
    ['npm', 'npm'],
    ['pnpm', 'pnpm'],
    ['yarn', 'yarn-classic'],
    ['yarn', 'yarn-berry'],
    ['bun', 'bun'],
  ] as const)(
    '%s / %s 在各预检入口拒绝工作区别名且不启动发布',
    async (packageManager, variant) => {
      const context = await fixture(packageManager)
      context.appData.packageManagerVariant = variant
      npmPlugin(context as unknown as ReleasePluginContext)
      gitPlugin(context as unknown as ReleasePluginContext)
      for (const args of [
        ['-'],
        ['--w=other-package'],
        ['--ws=true'],
        ['--C=/tmp/other-project'],
        ['-F', 'other-package'],
        ['--workspace-packages'],
      ]) {
        context.config.npm.publishArgs = args
        await expect(invoke(context.onCheck)).rejects.toThrow(
          'validated target',
        )
        await expect(invoke(context.onBeforeBumpVersion)).rejects.toThrow(
          'validated target',
        )
        await expect(invoke(context.onRelease)).rejects.toThrow(
          'validated target',
        )
      }
      expect(gitCommit).not.toHaveBeenCalled()
      expect(run).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['../archive.tgz'],
    ['--directory=dist'],
    ['--new-version', '2.0.0'],
    ['--filter=other'],
    ['--filter-prod=other'],
    ['--workspace-root'],
    ['--workspace-packages'],
    ['--workspace_packages'],
    ['-F', 'other-package'],
    ['-Fother-package'],
    ['--F=other-package'],
    ['---F=other-package'],
    ['--include-workspace-root'],
    ['--w=other-package'],
    ['--w', 'other-package'],
    ['--ws=true'],
    ['--C=/tmp/other-project'],
    ['--C', '/tmp/other-project'],
    ['--r'],
    ['--iwr=true'],
    ['--i=true'],
    ['--prefi=/tmp/other-project'],
    ['-i'],
    ['-iwr'],
    ['--include-w=true'],
    ['--include-workspace-r=true'],
    ['---w=other-package'],
    ['---ws=true'],
    ['---C=/tmp/other-project'],
    ['--no-no-w=other-package'],
    ['--no-no-ws=true'],
    ['--include_workspace_root=true'],
    ['---workspace=other-package'],
    ['---workspace', 'other-package'],
    ['---workspaces=true'],
    ['---prefix=/tmp/other-project'],
    ['---cwd=/tmp/other-project'],
    ['---dir=/tmp/other-project'],
    ['---directory=dist'],
    ['---new-version=2.0.0'],
    ['---workspace-root'],
    ['---filter=other'],
    ['---filter-prod=other'],
    ['---recursive'],
    ['----workspace=other-package'],
    ['--no-no-workspaces=true'],
    ['--workspace_root'],
    ['--new_version=2.0.0'],
    ['--WORKSPACE=other-package'],
    ['--', 'other'],
    ['-C', '/tmp/other-project'],
    ['-w', 'other-package'],
    ['-r'],
    ['-Cdist'],
    ['-rf'],
    ['-fr'],
  ])('拒绝绕过目标的 publishArgs %j', async (...args) => {
    const context = await fixture()
    context.config.npm.publishArgs = args
    npmPlugin(context as unknown as ReleasePluginContext)
    gitPlugin(context as unknown as ReleasePluginContext)
    await expect(invoke(context.onCheck)).rejects.toThrow('validated target')
    await expect(invoke(context.onBeforeBumpVersion)).rejects.toThrow(
      'validated target',
    )
    await expect(invoke(context.onRelease)).rejects.toThrow('validated target')
    expect(gitCommit).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it('缺失有效清单不能回退到早期内存，dryRun 仍使用预演版本', async () => {
    const context = await fixture('pnpm', {
      publishConfig: { directory: 'dist' },
    })
    npmPlugin(context as unknown as ReleasePluginContext)
    await invoke(context.onBeforeBumpVersion)
    await expect(invoke(context.onRelease)).rejects.toMatchObject({
      code: 'ENOENT',
    })
    context.config.dryRun = true
    await save(context.appData.workspacePackages[0].manifestPath, {
      name: 'app',
      version: '1.0.0',
    })
    await expect(invoke(context.onRelease)).resolves.toBeUndefined()
    expect(run).not.toHaveBeenCalled()
  })

  async function fixture(
    packageManager: AppData['packageManager'] = 'npm',
    fields: Partial<WorkspacePackageJson> = {},
  ) {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-publish-boundary-'))
    const rootPath = path.join(cwd, 'app')
    await mkdir(rootPath)
    const manifestPath = path.join(rootPath, 'package.json')
    await save(manifestPath, { name: 'app', version: info.version, ...fields })
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    const context = {
      cwd,
      config: {
        ...structuredClone(defaultConfig),
        git: {
          ...defaultConfig.git,
          push: false,
          requireClean: false,
          changelog: false,
        },
      } as ResolvedConfig,
      appData: {
        workspacePackages: [{ manifest, rootPath, manifestPath }],
        packageManager,
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
    return context
  }
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
