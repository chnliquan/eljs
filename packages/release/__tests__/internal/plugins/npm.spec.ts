import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest'
/**
 * @file packages/release internal/plugins/npm 模块单元测试
 * @description 测试 npm.ts NPM 相关插件功能
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { getNpmUser, logger, normalizeArgs, run } from '@eljs/utils'

import npmPlugin from '../../../src/internal/plugins/npm'
import type {
  Config,
  PrereleaseId,
  ReleasePluginContext,
} from '../../../src/types'

// 定义测试专用的 Mock API 类型，基于源代码类型
interface NpmTestApi {
  onCheck: MockedFunction<
    (
      handler: (args: { releaseTypeOrVersion?: string }) => Promise<void>,
    ) => void
  >
  onBeforeBumpVersion: MockedFunction<
    (
      handler: (args: {
        version: string
        isPrerelease: boolean
        prereleaseId: PrereleaseId | null
      }) => void,
      options?: { stage?: number },
    ) => void
  >
  onRelease: MockedFunction<
    (
      handler: (args: {
        version: string
        isPrerelease: boolean
        prereleaseId: PrereleaseId | null
        changelog: string
      }) => Promise<void>,
    ) => void
  >
  step: MockedFunction<(message: string) => void>
  config: Config
  appData: {
    workspacePackages: Array<{
      rootPath: string
      manifestPath: string
      manifest: {
        name: string
        version: string
        private?: boolean
        dependencies?: Record<string, string>
        optionalDependencies?: Record<string, string>
      }
    }>
    existingPkgNames?: string[]
    registry?: string
    packageManager: string
    packageManagerVariant: string
  }
  cwd: string
}

type TestWorkspacePackageInput =
  NpmTestApi['appData']['workspacePackages'][number]['manifest'] & {
    rootPath: string
  }

function setWorkspacePackages(
  context: NpmTestApi,
  packages: TestWorkspacePackageInput[],
): void {
  context.appData.workspacePackages = packages.map(
    ({ rootPath, ...manifest }) => ({
      manifest,
      manifestPath: `${rootPath}/package.json`,
      rootPath,
    }),
  )
}

// 全局类型定义
type OnCheckHandler = (args: { releaseTypeOrVersion?: string }) => Promise<void>
type OnBeforeBumpVersionHandler = (args: {
  version: string
  isPrerelease: boolean
  prereleaseId: PrereleaseId | null
}) => void
type OnReleaseHandler = (args: {
  version: string
  isPrerelease: boolean
  prereleaseId: PrereleaseId | null
  changelog: string
}) => Promise<void>

// 模拟所有依赖
vi.mock('@eljs/utils', () => ({
  chalk: {
    cyan: vi.fn((text: string) => `[cyan]${text}[/cyan]`),
    bold: {
      cyan: vi.fn((text: string) => `[bold-cyan]${text}[/bold-cyan]`),
    },
  },
  getNpmUser: vi.fn(),
  logger: {
    info: vi.fn(),
    ready: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  normalizeArgs: vi.fn(),
  run: vi.fn(),
}))
vi.mock('@eljs/utils/cp', async () => import('@eljs/utils'))
vi.mock('@eljs/utils/logger', async () => import('@eljs/utils'))
vi.mock('@eljs/utils/npm', async () => import('@eljs/utils'))

vi.mock('../../../src/utils', () => ({
  AppError: class AppError extends Error {
    public constructor(message: string) {
      super(message)
      this.name = 'AppError'
    }
  },
  ReleasePublishError: class ReleasePublishError extends Error {
    public readonly details: Record<string, unknown>

    public constructor(
      details: {
        failedPackage: string
        version: string
        publishedPackages: string[]
        unpublishedPackages: string[]
      },
      options?: unknown,
    ) {
      const published = details.publishedPackages
        .map(name => `${name}@${details.version}`)
        .join(', ')
      const unpublished = details.unpublishedPackages
        .map(name => `${name}@${details.version}`)
        .join(', ')
      super(
        `Failed to publish ${details.failedPackage}@${details.version}. Published before failure: ${published || 'none'}. Not published: ${unpublished}. Git changes were not pushed.`,
      )
      this.name = 'ReleasePublishError'
      this.details = details
      this.cause = options
    }
  },
  syncCnpm: vi.fn(),
}))

describe('NPM 插件测试', () => {
  let mockContext: NpmTestApi

  beforeEach(() => {
    mockContext = {
      onCheck: vi.fn(),
      onBeforeBumpVersion: vi.fn(),
      onRelease: vi.fn(),
      step: vi.fn(),
      config: {
        npm: {
          requireOwner: true,
          networkConcurrency: 8,
        },
        git: {
          requireClean: true,
          requireBranch: '',
          changelog: {
            filename: 'CHANGELOG.md',
            placeholder: '**Note:** No changes, only version bump.',
            preset: '@eljs/conventional-changelog-preset',
          },
          independent: false,
          commit: true,
          commitMessage: 'chore: bump version v${version}',
          commitArgs: [],
          push: true,
          pushArgs: ['--follow-tags'],
        },
      },
      appData: {
        workspacePackages: [
          {
            manifest: { name: 'test-package', version: '1.1.0' },
            manifestPath: '/test/package/package.json',
            rootPath: '/test/package',
          },
        ],
        packageManager: 'npm',
        packageManagerVariant: 'npm',
      },
      cwd: '/test/project',
    }

    vi.clearAllMocks()

    // 设置默认模拟返回值
    ;(getNpmUser as MockedFunction<typeof getNpmUser>).mockResolvedValue(
      'test-user',
    )
    ;(run as MockedFunction<typeof run>).mockResolvedValue({
      stdout: 'test-user <test@example.com>\nother-user <other@example.com>',
      stderr: '',
    } as Awaited<ReturnType<typeof run>>)
    ;(normalizeArgs as MockedFunction<typeof normalizeArgs>).mockImplementation(
      args => (typeof args === 'string' ? [args] : args || []),
    )
  })

  describe('插件注册', () => {
    it('应该注册所有必需的钩子方法', () => {
      npmPlugin(mockContext as unknown as ReleasePluginContext)

      expect(mockContext.onCheck).toHaveBeenCalledWith(expect.any(Function))
      expect(mockContext.onBeforeBumpVersion).toHaveBeenCalledWith(
        expect.any(Function),
        { stage: 10 },
      )
      expect(mockContext.onRelease).toHaveBeenCalledWith(expect.any(Function), {
        stage: 0,
      })
    })
  })

  describe('onCheck 钩子测试', () => {
    let onCheckHandler: OnCheckHandler

    beforeEach(() => {
      npmPlugin(mockContext as unknown as ReleasePluginContext)
      onCheckHandler = mockContext.onCheck.mock.calls[0][0] as OnCheckHandler
    })

    it('应该检查 NPM 包所有者', async () => {
      mockContext.config.npm!.requireOwner = true

      await onCheckHandler({ releaseTypeOrVersion: 'minor' })

      expect(mockContext.step).toHaveBeenCalledWith('Checking npm owner ...')
      expect(getNpmUser).toHaveBeenCalledWith({ cwd: '/test/project' })
      expect(run).toHaveBeenCalledWith('npm', ['owner', 'ls', 'test-package'], {
        cwd: '/test/project',
      })
    })

    it('当用户不是包所有者时应该抛出错误', async () => {
      ;(getNpmUser as MockedFunction<typeof getNpmUser>).mockResolvedValue(
        'unauthorized-user',
      )
      ;(run as MockedFunction<typeof run>).mockResolvedValue({
        stdout: 'authorized-user <auth@example.com>',
        stderr: '',
      } as Awaited<ReturnType<typeof run>>)

      await expect(
        onCheckHandler({ releaseTypeOrVersion: 'minor' }),
      ).rejects.toThrow(
        'User [cyan]unauthorized-user[/cyan] is not the owner of `test-package`.',
      )
    })

    it('应该使用发布 registry 校验当前用户和包所有者', async () => {
      mockContext.appData.registry = 'https://registry.example.com'
      ;(run as MockedFunction<typeof run>)
        .mockResolvedValueOnce({
          stdout: 'test-user',
          stderr: '',
        } as Awaited<ReturnType<typeof run>>)
        .mockResolvedValueOnce({
          stdout: 'test-user <test@example.com>',
          stderr: '',
        } as Awaited<ReturnType<typeof run>>)

      await onCheckHandler({ releaseTypeOrVersion: 'minor' })

      expect(getNpmUser).not.toHaveBeenCalled()
      expect(run).toHaveBeenNthCalledWith(
        1,
        'npm',
        ['whoami', '--registry', 'https://registry.example.com'],
        { cwd: '/test/project' },
      )
      expect(run).toHaveBeenNthCalledWith(
        2,
        'npm',
        [
          'owner',
          'ls',
          'test-package',
          '--registry',
          'https://registry.example.com',
        ],
        { cwd: '/test/project' },
      )
    })

    it('应该处理包不存在的情况', async () => {
      const notFoundError = new Error('npm ERR! 404 Not Found')
      notFoundError.message = 'npm ERR! 404 Not Found - test-package not found'
      ;(run as MockedFunction<typeof run>).mockRejectedValue(notFoundError)

      // 对于不存在的包，应该跳过检查
      await expect(
        onCheckHandler({ releaseTypeOrVersion: 'minor' }),
      ).resolves.toBeUndefined()
    })

    it('当不需要检查所有者时应该跳过', async () => {
      mockContext.config.npm!.requireOwner = false

      await onCheckHandler({ releaseTypeOrVersion: 'minor' })

      expect(getNpmUser).not.toHaveBeenCalled()
      expect(run).not.toHaveBeenCalled()
    })
  })

  describe('onBeforeBumpVersion 钩子测试', () => {
    let onBeforeBumpVersionHandler: OnBeforeBumpVersionHandler

    beforeEach(() => {
      npmPlugin(mockContext as unknown as ReleasePluginContext)
      onBeforeBumpVersionHandler = mockContext.onBeforeBumpVersion.mock
        .calls[0][0] as OnBeforeBumpVersionHandler
    })

    it('应该在写入版本文件前拒绝循环运行时依赖', () => {
      setWorkspacePackages(mockContext, [
        {
          name: 'pkg1',
          version: '1.1.0',
          dependencies: { pkg2: 'workspace:*' },
          rootPath: '/test/pkg1',
        },
        {
          name: 'pkg2',
          version: '1.1.0',
          dependencies: { pkg1: 'workspace:*' },
          rootPath: '/test/pkg2',
        },
      ])

      expect(() =>
        onBeforeBumpVersionHandler({
          version: '1.1.0',
          isPrerelease: false,
          prereleaseId: null,
        }),
      ).toThrow('circular runtime dependency')
      expect(run).not.toHaveBeenCalled()
    })
  })

  describe('onRelease 钩子测试', () => {
    let onReleaseHandler: OnReleaseHandler

    beforeEach(() => {
      npmPlugin(mockContext as unknown as ReleasePluginContext)
      onReleaseHandler = mockContext.onRelease.mock
        .calls[0][0] as OnReleaseHandler
    })

    it('应该发布包到 NPM', async () => {
      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: 'test',
      }

      await onReleaseHandler(versionInfo)

      // 验证 run 被调用进行发布，但不严格检查参数顺序
      expect(run).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['publish']),
        expect.objectContaining({
          cwd: '/test/package',
        }),
      )
      expect(logger.ready).toHaveBeenCalledWith(
        'Published [bold-cyan]test-package@1.1.0[/bold-cyan] successfully.',
      )
    })

    it('应该使用项目包管理器发布以正确转换 workspace 协议', async () => {
      mockContext.appData.packageManager = 'yarn'
      mockContext.appData.packageManagerVariant = 'yarn-classic'

      await onReleaseHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: 'test',
      })

      expect(run).toHaveBeenCalledWith(
        'yarn',
        expect.arrayContaining(['publish']),
        expect.objectContaining({ cwd: '/test/package' }),
      )
    })

    it('Yarn Berry 应该使用 yarn npm publish', async () => {
      mockContext.appData.packageManager = 'yarn'
      mockContext.appData.packageManagerVariant = 'yarn-berry'
      mockContext.appData.registry = 'https://registry.example.com'

      await onReleaseHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: 'test',
      })

      expect(run).toHaveBeenCalledWith(
        'yarn',
        expect.not.arrayContaining(['--registry']),
        expect.objectContaining({
          cwd: '/test/package',
          env: {
            YARN_NPM_PUBLISH_REGISTRY: 'https://registry.example.com',
          },
        }),
      )
      expect(run).toHaveBeenCalledWith(
        'yarn',
        expect.arrayContaining(['npm', 'publish']),
        expect.any(Object),
      )
    })

    it('dry-run 时应该输出发布计划且不执行 npm publish', async () => {
      mockContext.config.dryRun = true

      await onReleaseHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: 'test',
      })

      expect(run).not.toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith(
        'Would publish [cyan]test-package@1.1.0[/cyan] from /test/package.',
      )
    })

    it('应该为预发布版本使用 tag', async () => {
      mockContext.appData.workspacePackages[0].manifest.version =
        '1.1.0-alpha.1'
      const versionInfo = {
        version: '1.1.0-alpha.1',
        isPrerelease: true,
        prereleaseId: 'alpha' as PrereleaseId,
        changelog: 'test',
      }

      await onReleaseHandler(versionInfo)

      expect(run).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['publish', '--tag', 'alpha']),
        expect.objectContaining({
          cwd: '/test/package',
        }),
      )
    })

    it('数字型预发布版本应该使用安全的 next tag', async () => {
      mockContext.appData.workspacePackages[0].manifest.version = '1.1.0-1'

      await onReleaseHandler({
        version: '1.1.0-1',
        isPrerelease: true,
        prereleaseId: null,
        changelog: 'test',
      })

      expect(run).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['publish', '--tag', 'next']),
        expect.objectContaining({ cwd: '/test/package' }),
      )
    })

    it('应该处理多个包的发布', async () => {
      setWorkspacePackages(mockContext, [
        { name: 'pkg1', version: '1.1.0', rootPath: '/test/pkg1' },
        { name: 'pkg2', version: '1.1.0', rootPath: '/test/pkg2' },
      ])
      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: 'test',
      }

      await onReleaseHandler(versionInfo)

      expect(run).toHaveBeenCalledTimes(2)
      expect(logger.ready).toHaveBeenCalledTimes(2)
      expect(logger.ready).toHaveBeenNthCalledWith(
        1,
        'Published [bold-cyan]pkg1@1.1.0[/bold-cyan] successfully.',
      )
      expect(logger.ready).toHaveBeenNthCalledWith(
        2,
        'Published [bold-cyan]pkg2@1.1.0[/bold-cyan] successfully.',
      )
    })

    it('应该按照 workspace 运行时依赖顺序发布', async () => {
      setWorkspacePackages(mockContext, [
        {
          name: 'app',
          version: '1.1.0',
          dependencies: { core: 'workspace:*' },
          rootPath: '/test/app',
        },
        { name: 'core', version: '1.1.0', rootPath: '/test/core' },
      ])

      await onReleaseHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: 'test',
      })

      expect(run).toHaveBeenNthCalledWith(
        1,
        'npm',
        expect.arrayContaining(['publish']),
        expect.objectContaining({ cwd: '/test/core' }),
      )
      expect(run).toHaveBeenNthCalledWith(
        2,
        'npm',
        expect.arrayContaining(['publish']),
        expect.objectContaining({ cwd: '/test/app' }),
      )
    })

    it('应该在发布前拒绝循环运行时依赖', async () => {
      setWorkspacePackages(mockContext, [
        {
          name: 'pkg1',
          version: '1.1.0',
          dependencies: { pkg2: 'workspace:*' },
          rootPath: '/test/pkg1',
        },
        {
          name: 'pkg2',
          version: '1.1.0',
          dependencies: { pkg1: 'workspace:*' },
          rootPath: '/test/pkg2',
        },
      ])

      await expect(
        onReleaseHandler({
          version: '1.1.0',
          isPrerelease: false,
          prereleaseId: null,
          changelog: 'test',
        }),
      ).rejects.toThrow('circular runtime dependency')
      expect(run).not.toHaveBeenCalled()
    })

    it('应该在发布前拒绝重复的 workspace 包名', async () => {
      setWorkspacePackages(mockContext, [
        { name: 'pkg1', version: '1.1.0', rootPath: '/test/pkg1' },
        { name: 'pkg1', version: '1.1.0', rootPath: '/test/pkg1-copy' },
      ])

      await expect(
        onReleaseHandler({
          version: '1.1.0',
          isPrerelease: false,
          prereleaseId: null,
          changelog: 'test',
        }),
      ).rejects.toThrow('workspace package names must be unique')
      expect(run).not.toHaveBeenCalled()
    })

    it('应该在发布前拒绝依赖私有 workspace 包', async () => {
      setWorkspacePackages(mockContext, [
        {
          name: 'public-package',
          version: '1.1.0',
          dependencies: { 'private-package': 'workspace:*' },
          rootPath: '/test/public-package',
        },
        {
          name: 'private-package',
          version: '1.1.0',
          private: true,
          rootPath: '/test/private-package',
        },
      ])

      await expect(
        onReleaseHandler({
          version: '1.1.0',
          isPrerelease: false,
          prereleaseId: null,
          changelog: 'test',
        }),
      ).rejects.toThrow('depends on non-publishable workspace package')
      expect(run).not.toHaveBeenCalled()
    })

    it('应该使用自定义发布参数', async () => {
      mockContext.config.npm!.publishArgs = ['--access', 'public']
      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: 'test',
      }

      await onReleaseHandler(versionInfo)

      expect(normalizeArgs).toHaveBeenCalledWith(['--access', 'public'])
      expect(run).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['publish', '--access', 'public']),
        expect.any(Object),
      )
    })

    it('应该在重试发布时跳过已由版本预检确认的包', async () => {
      mockContext.appData.existingPkgNames = ['test-package']

      await onReleaseHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: 'test',
      })

      expect(run).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(
        'Skipping already published [cyan]test-package@1.1.0[/cyan].',
      )
    })

    it('应该处理发布失败情况', async () => {
      // 模拟所有发布都失败
      ;(run as MockedFunction<typeof run>).mockRejectedValue(
        new Error('发布失败'),
      )
      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: 'test',
      }

      await expect(onReleaseHandler(versionInfo)).rejects.toThrow(
        'Failed to publish test-package@1.1.0. Published before failure: none. Not published: test-package@1.1.0. Git changes were not pushed.',
      )

      expect(logger.error).toHaveBeenCalled()
    })

    it('应该在首个失败后停止并报告已经发布和尚未发布的包', async () => {
      setWorkspacePackages(mockContext, [
        { name: 'core', version: '1.1.0', rootPath: '/test/core' },
        { name: 'app', version: '1.1.0', rootPath: '/test/app' },
        { name: 'cli', version: '1.1.0', rootPath: '/test/cli' },
      ])
      ;(run as MockedFunction<typeof run>)
        .mockResolvedValueOnce({
          stdout: '',
        } as Awaited<ReturnType<typeof run>>)
        .mockRejectedValueOnce(new Error('registry unavailable'))

      await expect(
        onReleaseHandler({
          version: '1.1.0',
          isPrerelease: false,
          prereleaseId: null,
          changelog: 'test',
        }),
      ).rejects.toThrow(
        'Published before failure: core@1.1.0. Not published: app@1.1.0, cli@1.1.0.',
      )
      expect(run).toHaveBeenCalledTimes(2)
    })

    it('发布中断错误应该提供结构化恢复进度', async () => {
      setWorkspacePackages(mockContext, [
        { name: 'core', version: '1.1.0', rootPath: '/test/core' },
        { name: 'app', version: '1.1.0', rootPath: '/test/app' },
      ])
      ;(run as MockedFunction<typeof run>)
        .mockResolvedValueOnce({ stdout: '' } as Awaited<
          ReturnType<typeof run>
        >)
        .mockRejectedValueOnce(new Error('registry unavailable'))

      const error = await onReleaseHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: 'test',
      }).catch(value => value)

      expect(error).toMatchObject({
        name: 'ReleasePublishError',
        details: {
          failedPackage: 'app',
          version: '1.1.0',
          publishedPackages: ['core'],
          unpublishedPackages: ['app'],
        },
      })
    })
  })

  describe('插件导出验证', () => {
    it('应该是一个函数', () => {
      expect(typeof npmPlugin).toBe('function')
    })

    it('应该接受 API 参数', () => {
      expect(npmPlugin.length).toBe(1)
    })

    it('应该没有返回值', () => {
      const result = npmPlugin(mockContext as unknown as ReleasePluginContext)
      expect(result).toBeUndefined()
    })
  })

  describe('NPM 插件完整功能测试', () => {
    it('应该完整执行 NPM 工作流', async () => {
      npmPlugin(mockContext as unknown as ReleasePluginContext)

      const onCheckHandler = mockContext.onCheck.mock
        .calls[0][0] as OnCheckHandler
      const onReleaseHandler = mockContext.onRelease.mock
        .calls[0][0] as OnReleaseHandler

      // 执行检查阶段
      await onCheckHandler({ releaseTypeOrVersion: 'minor' })
      expect(getNpmUser).toHaveBeenCalled()

      // 执行发布阶段
      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: 'test',
      }
      await onReleaseHandler(versionInfo)
      expect(run).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['publish']),
        expect.any(Object),
      )
    })

    it('应该正确处理预发布和正式发布', async () => {
      npmPlugin(mockContext as unknown as ReleasePluginContext)
      const onReleaseHandler = mockContext.onRelease.mock
        .calls[0][0] as OnReleaseHandler

      // 测试正式发布
      mockContext.appData.workspacePackages[0].manifest.version = '1.0.0'
      await onReleaseHandler({
        version: '1.0.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: 'test',
      })
      expect(run).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['publish']),
        expect.any(Object),
      )

      vi.clearAllMocks()

      // 测试预发布
      mockContext.appData.workspacePackages[0].manifest.version = '1.1.0-beta.1'
      await onReleaseHandler({
        version: '1.1.0-beta.1',
        isPrerelease: true,
        prereleaseId: 'beta' as PrereleaseId,
        changelog: 'test',
      })
      expect(run).toHaveBeenCalledWith(
        'npm',
        expect.arrayContaining(['publish', '--tag', 'beta']),
        expect.any(Object),
      )
    })

    it('应该处理空的包名列表', async () => {
      mockContext.appData.workspacePackages = []

      npmPlugin(mockContext as unknown as ReleasePluginContext)
      const onCheckHandler = mockContext.onCheck.mock
        .calls[0][0] as OnCheckHandler
      const onReleaseHandler = mockContext.onRelease.mock
        .calls[0][0] as OnReleaseHandler

      // 检查阶段
      await onCheckHandler({ releaseTypeOrVersion: 'minor' })
      expect(run).not.toHaveBeenCalled()

      // 发布阶段
      await onReleaseHandler({
        version: '1.0.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: 'test',
      })
      // 由于没有包，应该没有发布命令
      expect(logger.ready).not.toHaveBeenCalled()
    })
  })

  describe('错误处理和边界情况', () => {
    it('应该处理复杂的所有者列表格式', async () => {
      npmPlugin(mockContext as unknown as ReleasePluginContext)
      const onCheckHandler = mockContext.onCheck.mock
        .calls[0][0] as OnCheckHandler

      ;(run as MockedFunction<typeof run>).mockResolvedValue({
        stdout: `test-user <test@example.com>\nadmin <admin@example.com>\nmaintainer <maintainer@example.com>`,
        stderr: '',
      } as Awaited<ReturnType<typeof run>>)

      await expect(
        onCheckHandler({ releaseTypeOrVersion: 'minor' }),
      ).resolves.toBeUndefined()
    })

    it('应该处理 404 错误（包不存在）', async () => {
      npmPlugin(mockContext as unknown as ReleasePluginContext)
      const onCheckHandler = mockContext.onCheck.mock
        .calls[0][0] as OnCheckHandler

      const notFoundError = new Error(
        'npm ERR! 404 Not Found - package not found',
      )
      ;(run as MockedFunction<typeof run>).mockRejectedValue(notFoundError)

      await expect(
        onCheckHandler({ releaseTypeOrVersion: 'minor' }),
      ).resolves.toBeUndefined()
    })

    it('应该处理获取用户信息失败', async () => {
      npmPlugin(mockContext as unknown as ReleasePluginContext)
      const onCheckHandler = mockContext.onCheck.mock
        .calls[0][0] as OnCheckHandler

      ;(getNpmUser as MockedFunction<typeof getNpmUser>).mockRejectedValue(
        new Error('无法获取用户信息'),
      )

      await expect(
        onCheckHandler({ releaseTypeOrVersion: 'minor' }),
      ).rejects.toThrow('无法获取用户信息')
    })
  })
})
