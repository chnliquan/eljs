import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest'
/**
 * @file packages/release internal/plugins/github 模块单元测试
 * @description 测试 github.ts GitHub 发布插件功能
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { getGitUrl, getGitUrlSync, gitUrlAnalysis, logger } from '@eljs/utils'
import newGithubReleaseUrl from 'new-github-release-url'
import open from 'open'

import githubPlugin from '../../../src/internal/plugins/github'
import type {
  Config,
  PrereleaseId,
  ReleasePluginContext,
} from '../../../src/types'

// 定义测试专用的 Mock API 类型，基于源代码类型
interface GitHubTestApi {
  describe: MockedFunction<
    (options: { enable: (args: { cwd: string }) => boolean }) => void
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
  onCheck: MockedFunction<(handler: () => Promise<void>) => void>
  config: Config
  appData: {
    validPkgNames: string[]
  }
  cwd: string
}

// 全局类型定义
type OnReleaseHandler = (args: {
  version: string
  isPrerelease: boolean
  prereleaseId: PrereleaseId | null
  changelog: string
}) => Promise<void>

// 模拟所有依赖
vi.mock('@eljs/utils', () => ({
  getGitUrl: vi.fn(),
  getGitUrlSync: vi.fn(),
  gitUrlAnalysis: vi.fn(),
  logger: {
    info: vi.fn(),
    ready: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('new-github-release-url', () => ({ default: vi.fn() }))
vi.mock('open')

describe('GitHub 插件测试', () => {
  let mockContext: GitHubTestApi

  beforeEach(() => {
    mockContext = {
      describe: vi.fn(),
      onCheck: vi.fn(),
      onRelease: vi.fn(),
      config: {
        git: {
          independent: false,
        },
        github: {
          release: true,
          mode: 'browser',
          tokenEnv: 'GITHUB_TOKEN',
        },
      } as Config,
      appData: {
        validPkgNames: ['it-package'],
      },
      cwd: '/it/project',
    }

    vi.clearAllMocks()

    // 设置默认模拟返回值
    ;(getGitUrlSync as MockedFunction<typeof getGitUrlSync>).mockReturnValue(
      'https://github.com/user/repo.git',
    )
    ;(getGitUrl as MockedFunction<typeof getGitUrl>).mockResolvedValue(
      'https://github.com/user/repo.git',
    )
    ;(gitUrlAnalysis as MockedFunction<typeof gitUrlAnalysis>).mockReturnValue({
      href: 'https://github.com/user/repo',
    } as ReturnType<typeof gitUrlAnalysis>)
    ;(
      newGithubReleaseUrl as MockedFunction<typeof newGithubReleaseUrl>
    ).mockReturnValue('https://github.com/user/repo/releases/new?tag=v1.1.0')
    ;(open as MockedFunction<typeof open>).mockResolvedValue(
      {} as Awaited<ReturnType<typeof open>>,
    )
  })

  afterEach(() => {
    delete process.env.RELEASE_TEST_GITHUB_TOKEN
    vi.unstubAllGlobals()
  })

  describe('插件注册', () => {
    it('应该注册所有必需的钩子方法', () => {
      githubPlugin(mockContext as unknown as ReleasePluginContext)

      expect(mockContext.describe).toHaveBeenCalledWith({
        enable: expect.any(Function),
      })
      expect(mockContext.onCheck).toHaveBeenCalledWith(expect.any(Function))
      expect(mockContext.onRelease).toHaveBeenCalledWith(expect.any(Function), {
        stage: 20,
      })
    })
  })

  describe('插件启用条件测试', () => {
    it('应该在 GitHub 仓库中启用', () => {
      ;(getGitUrlSync as MockedFunction<typeof getGitUrlSync>).mockReturnValue(
        'https://github.com/user/repo.git',
      )

      githubPlugin(mockContext as unknown as ReleasePluginContext)
      const describeCall = mockContext.describe.mock.calls[0][0]

      const isEnabled = describeCall.enable({ cwd: '/it/project' })
      expect(isEnabled).toBe(true)
    })

    it('应该在非 GitHub 仓库中禁用', () => {
      ;(getGitUrlSync as MockedFunction<typeof getGitUrlSync>).mockReturnValue(
        'https://gitlab.com/user/repo.git',
      )
      ;(
        gitUrlAnalysis as MockedFunction<typeof gitUrlAnalysis>
      ).mockReturnValue({
        href: 'https://gitlab.com/user/repo',
      } as ReturnType<typeof gitUrlAnalysis>)

      githubPlugin(mockContext as unknown as ReleasePluginContext)
      const describeCall = mockContext.describe.mock.calls[0][0]

      const isEnabled = describeCall.enable({ cwd: '/it/project' })
      expect(isEnabled).toBe(false)
    })

    it('仓库域名仅包含 github 字样时不应该启用', () => {
      ;(getGitUrlSync as MockedFunction<typeof getGitUrlSync>).mockReturnValue(
        'https://evilgithub.com/user/repo.git',
      )
      ;(
        gitUrlAnalysis as MockedFunction<typeof gitUrlAnalysis>
      ).mockReturnValue({
        href: 'https://evilgithub.com/user/repo',
      } as ReturnType<typeof gitUrlAnalysis>)

      githubPlugin(mockContext as unknown as ReleasePluginContext)
      const describeCall = mockContext.describe.mock.calls[0][0]

      expect(describeCall.enable({ cwd: '/it/project' })).toBe(false)
    })

    it('应该支持以 github 子域标识的企业仓库', () => {
      ;(getGitUrlSync as MockedFunction<typeof getGitUrlSync>).mockReturnValue(
        'https://github.corp.example.com/user/repo.git',
      )
      ;(
        gitUrlAnalysis as MockedFunction<typeof gitUrlAnalysis>
      ).mockReturnValue({
        href: 'https://github.corp.example.com/user/repo',
      } as ReturnType<typeof gitUrlAnalysis>)

      githubPlugin(mockContext as unknown as ReleasePluginContext)
      const describeCall = mockContext.describe.mock.calls[0][0]

      expect(describeCall.enable({ cwd: '/it/project' })).toBe(true)
    })
  })

  describe('onRelease 钩子测试', () => {
    let onReleaseHandler: OnReleaseHandler

    beforeEach(() => {
      githubPlugin(mockContext as unknown as ReleasePluginContext)
      onReleaseHandler = mockContext.onRelease.mock
        .calls[0][0] as OnReleaseHandler
    })

    it('应该创建 GitHub 发布', async () => {
      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## [1.1.0] - 2023-11-13\n\n- Added new feature',
      }

      await onReleaseHandler(versionInfo)

      expect(newGithubReleaseUrl).toHaveBeenCalledWith({
        repoUrl: 'https://github.com/user/repo',
        tag: 'v1.1.0',
        body: '## [1.1.0] - 2023-11-13\n\n- Added new feature',
        isPrerelease: false,
      })
      expect(open).toHaveBeenCalledWith(
        'https://github.com/user/repo/releases/new?tag=v1.1.0',
      )
    })

    it('应该为预发布版本标记 isPrerelease', async () => {
      const versionInfo = {
        version: '1.1.0-beta.1',
        isPrerelease: true,
        prereleaseId: 'beta' as PrereleaseId,
        changelog: '## [1.1.0-beta.1] - 2023-11-13\n\n- Added beta feature',
      }

      await onReleaseHandler(versionInfo)

      expect(newGithubReleaseUrl).toHaveBeenCalledWith({
        repoUrl: 'https://github.com/user/repo',
        tag: 'v1.1.0-beta.1',
        body: '## [1.1.0-beta.1] - 2023-11-13\n\n- Added beta feature',
        isPrerelease: true,
      })
    })

    it('独立标签模式应该为每个可发布包准备对应的发布页面', async () => {
      mockContext.config.git!.independent = true
      mockContext.appData.validPkgNames = ['core', 'app']

      await onReleaseHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      })

      expect(newGithubReleaseUrl).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ tag: 'core@1.1.0' }),
      )
      expect(newGithubReleaseUrl).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ tag: 'app@1.1.0' }),
      )
      expect(open).toHaveBeenCalledTimes(2)
    })

    it('当禁用 GitHub 发布时应该跳过', async () => {
      mockContext.config.github!.release = false

      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      await onReleaseHandler(versionInfo)

      expect(getGitUrl).not.toHaveBeenCalled()
      expect(newGithubReleaseUrl).not.toHaveBeenCalled()
      expect(open).not.toHaveBeenCalled()
    })

    it('dry-run 时不应该打开 GitHub 发布页面', async () => {
      mockContext.config.dryRun = true

      await onReleaseHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      })

      expect(getGitUrl).not.toHaveBeenCalled()
      expect(newGithubReleaseUrl).not.toHaveBeenCalled()
      expect(open).not.toHaveBeenCalled()
    })

    it('当没有 changelog 时应该跳过', async () => {
      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '',
      }

      await onReleaseHandler(versionInfo)

      expect(getGitUrl).not.toHaveBeenCalled()
      expect(newGithubReleaseUrl).not.toHaveBeenCalled()
      expect(open).not.toHaveBeenCalled()
    })

    it('当无法获取 Git URL 时应该跳过', async () => {
      ;(getGitUrl as MockedFunction<typeof getGitUrl>).mockResolvedValue('')

      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      await onReleaseHandler(versionInfo)

      expect(newGithubReleaseUrl).not.toHaveBeenCalled()
      expect(open).not.toHaveBeenCalled()
    })

    it('当无法解析仓库 URL 时应该跳过', async () => {
      ;(
        gitUrlAnalysis as MockedFunction<typeof gitUrlAnalysis>
      ).mockReturnValue(null)

      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      await onReleaseHandler(versionInfo)

      expect(newGithubReleaseUrl).not.toHaveBeenCalled()
      expect(open).not.toHaveBeenCalled()
    })
  })

  describe('错误处理测试', () => {
    let onReleaseHandler: OnReleaseHandler

    beforeEach(() => {
      githubPlugin(mockContext as unknown as ReleasePluginContext)
      onReleaseHandler = mockContext.onRelease.mock
        .calls[0][0] as OnReleaseHandler
    })

    it('应该处理 getGitUrl 错误', async () => {
      ;(getGitUrl as MockedFunction<typeof getGitUrl>).mockRejectedValue(
        new Error('Git URL error'),
      )

      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      // 错误应该被传播
      await expect(onReleaseHandler(versionInfo)).rejects.toThrow(
        'Git URL error',
      )
    })

    it('打开浏览器失败时应该输出可复制链接且不中断发布', async () => {
      ;(open as MockedFunction<typeof open>).mockRejectedValue(
        new Error('Open failed'),
      )

      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      await expect(onReleaseHandler(versionInfo)).resolves.toBeUndefined()
      expect(logger.warn).toHaveBeenCalledWith(
        'Could not open the GitHub Release page: Open failed',
      )
      expect(logger.info).toHaveBeenCalledWith(
        'Open this URL manually: https://github.com/user/repo/releases/new?tag=v1.1.0',
      )
    })
  })

  describe('GitHub API 模式', () => {
    function enableApiMode(): {
      onCheckHandler: () => Promise<void>
      onReleaseHandler: OnReleaseHandler
    } {
      mockContext.config.github = {
        mode: 'api',
        release: true,
        tokenEnv: 'RELEASE_TEST_GITHUB_TOKEN',
      }
      githubPlugin(mockContext as unknown as ReleasePluginContext)

      return {
        onCheckHandler: mockContext.onCheck.mock.calls[0][0],
        onReleaseHandler: mockContext.onRelease.mock
          .calls[0][0] as OnReleaseHandler,
      }
    }

    it('预检时应该拒绝缺失令牌', async () => {
      const { onCheckHandler } = enableApiMode()

      await expect(onCheckHandler()).rejects.toThrow(
        'RELEASE_TEST_GITHUB_TOKEN',
      )
    })

    it('应该通过 REST API 创建 Release', async () => {
      process.env.RELEASE_TEST_GITHUB_TOKEN = 'secret-token'
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response('', { status: 404 }))
        .mockResolvedValueOnce(
          new Response('{"tag_name":"v1.1.0"}', { status: 201 }),
        )
      vi.stubGlobal('fetch', fetchMock)
      const { onCheckHandler, onReleaseHandler } = enableApiMode()

      await expect(onCheckHandler()).resolves.toBeUndefined()
      await onReleaseHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      })

      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'https://api.github.com/repos/user/repo/releases/tags/v1.1.0',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-token',
          }),
        }),
      )
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/user/repo/releases',
        expect.objectContaining({
          body: JSON.stringify({
            body: '## Changes',
            name: 'v1.1.0',
            prerelease: false,
            tag_name: 'v1.1.0',
          }),
          method: 'POST',
        }),
      )
      expect(open).not.toHaveBeenCalled()
      expect(logger.ready).toHaveBeenCalledWith(
        'Created GitHub Release `v1.1.0` successfully.',
      )
    })

    it('已存在同名 Release 时应该幂等跳过', async () => {
      process.env.RELEASE_TEST_GITHUB_TOKEN = 'secret-token'
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{}', { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)
      const { onReleaseHandler } = enableApiMode()

      await onReleaseHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(logger.warn).toHaveBeenCalledWith(
        'GitHub Release `v1.1.0` already exists; skipping creation.',
      )
    })

    it('创建时发生并发冲突应该再次查询并复用 Release', async () => {
      process.env.RELEASE_TEST_GITHUB_TOKEN = 'secret-token'
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response('', { status: 404 }))
        .mockResolvedValueOnce(new Response('{}', { status: 422 }))
        .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)
      const { onReleaseHandler } = enableApiMode()

      await onReleaseHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      })

      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(logger.warn).toHaveBeenCalledWith(
        'GitHub Release `v1.1.0` was created concurrently; reusing it.',
      )
    })

    it('API 查询失败时应该传播不包含令牌的诊断信息', async () => {
      process.env.RELEASE_TEST_GITHUB_TOKEN = 'secret-token'
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response('{"message":"server error"}', { status: 500 }),
        )
      vi.stubGlobal('fetch', fetchMock)
      const { onReleaseHandler } = enableApiMode()

      const error = await onReleaseHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }).catch(value => value)

      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toContain('HTTP 500')
      expect((error as Error).message).not.toContain('secret-token')
    })

    it('企业 GitHub 应该使用 /api/v3 端点', async () => {
      process.env.RELEASE_TEST_GITHUB_TOKEN = 'secret-token'
      ;(
        gitUrlAnalysis as MockedFunction<typeof gitUrlAnalysis>
      ).mockReturnValue({
        href: 'https://github.corp.example.com/team/repo',
      } as ReturnType<typeof gitUrlAnalysis>)
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{}', { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)
      const { onReleaseHandler } = enableApiMode()

      await onReleaseHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      })

      expect(fetchMock).toHaveBeenCalledWith(
        'https://github.corp.example.com/api/v3/repos/team/repo/releases/tags/v1.1.0',
        expect.any(Object),
      )
    })
  })

  describe('插件导出验证', () => {
    it('应该是一个函数', () => {
      expect(typeof githubPlugin).toBe('function')
    })

    it('应该接受 API 参数', () => {
      expect(githubPlugin.length).toBe(1)
    })

    it('应该没有返回值', () => {
      const result = githubPlugin(
        mockContext as unknown as ReleasePluginContext,
      )
      expect(result).toBeUndefined()
    })
  })

  describe('GitHub 插件集成测试', () => {
    it('应该完整执行 GitHub 发布流程', async () => {
      githubPlugin(mockContext as unknown as ReleasePluginContext)

      // 1. 检查插件是否启用
      const describeCall = mockContext.describe.mock.calls[0][0]
      const isEnabled = describeCall.enable({ cwd: '/it/project' })
      expect(isEnabled).toBe(true)

      // 2. 执行发布流程
      const onReleaseHandler = mockContext.onRelease.mock
        .calls[0][0] as OnReleaseHandler
      await onReleaseHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      })

      expect(getGitUrl).toHaveBeenCalled()
      expect(gitUrlAnalysis).toHaveBeenCalled()
      expect(newGithubReleaseUrl).toHaveBeenCalled()
      expect(open).toHaveBeenCalled()
    })

    it('应该处理不同版本类型', async () => {
      githubPlugin(mockContext as unknown as ReleasePluginContext)
      const onReleaseHandler = mockContext.onRelease.mock
        .calls[0][0] as OnReleaseHandler

      // 测试预发布版本
      await onReleaseHandler({
        version: '1.1.0-alpha.1',
        isPrerelease: true,
        prereleaseId: 'alpha' as PrereleaseId,
        changelog: '## Alpha Changes',
      })

      expect(newGithubReleaseUrl).toHaveBeenCalledWith({
        repoUrl: 'https://github.com/user/repo',
        tag: 'v1.1.0-alpha.1',
        body: '## Alpha Changes',
        isPrerelease: true,
      })
    })
  })
})
