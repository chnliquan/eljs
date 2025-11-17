/**
 * @file packages/release internal/plugins/github 模块单元测试
 * @description 测试 github.ts GitHub 发布插件功能
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { getGitUrl, getGitUrlSync, gitUrlAnalysis } from '@eljs/utils'
import newGithubReleaseUrl from 'new-github-release-url'
import open from 'open'

import githubPlugin from '../../../src/internal/plugins/github'
import type { Api, Config, PrereleaseId } from '../../../src/types'

// 定义测试专用的 Mock API 类型，基于源代码类型
interface GitHubTestApi {
  describe: jest.MockedFunction<
    (options: { enable: (args: { cwd: string }) => boolean }) => void
  >
  onRelease: jest.MockedFunction<
    (
      handler: (args: {
        version: string
        isPrerelease: boolean
        prereleaseId: PrereleaseId | null
        changelog: string
      }) => Promise<void>,
    ) => void
  >
  config: Config
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
jest.mock('@eljs/utils', () => ({
  getGitUrl: jest.fn(),
  getGitUrlSync: jest.fn(),
  gitUrlAnalysis: jest.fn(),
}))

jest.mock('new-github-release-url', () => jest.fn())
jest.mock('open')

describe('GitHub 插件测试', () => {
  let mockApi: GitHubTestApi

  beforeEach(() => {
    mockApi = {
      describe: jest.fn(),
      onRelease: jest.fn(),
      config: {
        github: {
          release: true,
        },
      } as Config,
      cwd: '/test/project',
    }

    jest.clearAllMocks()

    // 设置默认模拟返回值
    ;(
      getGitUrlSync as jest.MockedFunction<typeof getGitUrlSync>
    ).mockReturnValue('https://github.com/user/repo.git')
    ;(getGitUrl as jest.MockedFunction<typeof getGitUrl>).mockResolvedValue(
      'https://github.com/user/repo.git',
    )
    ;(
      gitUrlAnalysis as jest.MockedFunction<typeof gitUrlAnalysis>
    ).mockReturnValue({
      href: 'https://github.com/user/repo',
    } as ReturnType<typeof gitUrlAnalysis>)
    ;(
      newGithubReleaseUrl as jest.MockedFunction<typeof newGithubReleaseUrl>
    ).mockReturnValue('https://github.com/user/repo/releases/new?tag=v1.1.0')
    ;(open as jest.MockedFunction<typeof open>).mockResolvedValue(
      {} as ReturnType<typeof open>,
    )
  })

  describe('插件注册', () => {
    test('应该注册所有必需的钩子方法', () => {
      githubPlugin(mockApi as unknown as Api)

      expect(mockApi.describe).toHaveBeenCalledWith({
        enable: expect.any(Function),
      })
      expect(mockApi.onRelease).toHaveBeenCalledWith(expect.any(Function))
    })
  })

  describe('插件启用条件测试', () => {
    test('应该在 GitHub 仓库中启用', () => {
      ;(
        getGitUrlSync as jest.MockedFunction<typeof getGitUrlSync>
      ).mockReturnValue('https://github.com/user/repo.git')

      githubPlugin(mockApi as unknown as Api)
      const describeCall = mockApi.describe.mock.calls[0][0]

      const isEnabled = describeCall.enable({ cwd: '/test/project' })
      expect(isEnabled).toBe(true)
    })

    test('应该在非 GitHub 仓库中禁用', () => {
      ;(
        getGitUrlSync as jest.MockedFunction<typeof getGitUrlSync>
      ).mockReturnValue('https://gitlab.com/user/repo.git')

      githubPlugin(mockApi as unknown as Api)
      const describeCall = mockApi.describe.mock.calls[0][0]

      const isEnabled = describeCall.enable({ cwd: '/test/project' })
      expect(isEnabled).toBe(false)
    })
  })

  describe('onRelease 钩子测试', () => {
    let onReleaseHandler: OnReleaseHandler

    beforeEach(() => {
      githubPlugin(mockApi as unknown as Api)
      onReleaseHandler = mockApi.onRelease.mock.calls[0][0] as OnReleaseHandler
    })

    test('应该创建 GitHub 发布', async () => {
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

    test('应该为预发布版本标记 isPrerelease', async () => {
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

    test('当禁用 GitHub 发布时应该跳过', async () => {
      mockApi.config.github!.release = false

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

    test('当没有 changelog 时应该跳过', async () => {
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

    test('当无法获取 Git URL 时应该跳过', async () => {
      ;(getGitUrl as jest.MockedFunction<typeof getGitUrl>).mockResolvedValue(
        '',
      )

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

    test('当无法解析仓库 URL 时应该跳过', async () => {
      ;(
        gitUrlAnalysis as jest.MockedFunction<typeof gitUrlAnalysis>
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
      githubPlugin(mockApi as unknown as Api)
      onReleaseHandler = mockApi.onRelease.mock.calls[0][0] as OnReleaseHandler
    })

    test('应该处理 getGitUrl 错误', async () => {
      ;(getGitUrl as jest.MockedFunction<typeof getGitUrl>).mockRejectedValue(
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

    test('应该处理 open 错误', async () => {
      ;(open as jest.MockedFunction<typeof open>).mockRejectedValue(
        new Error('Open failed'),
      )

      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      // 错误应该被传播
      await expect(onReleaseHandler(versionInfo)).rejects.toThrow('Open failed')
    })
  })

  describe('插件导出验证', () => {
    test('应该是一个函数', () => {
      expect(typeof githubPlugin).toBe('function')
    })

    test('应该接受 API 参数', () => {
      expect(githubPlugin.length).toBe(1)
    })

    test('应该没有返回值', () => {
      const result = githubPlugin(mockApi as unknown as Api)
      expect(result).toBeUndefined()
    })
  })

  describe('GitHub 插件集成测试', () => {
    test('应该完整执行 GitHub 发布流程', async () => {
      githubPlugin(mockApi as unknown as Api)

      // 1. 检查插件是否启用
      const describeCall = mockApi.describe.mock.calls[0][0]
      const isEnabled = describeCall.enable({ cwd: '/test/project' })
      expect(isEnabled).toBe(true)

      // 2. 执行发布流程
      const onReleaseHandler = mockApi.onRelease.mock
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

    test('应该处理不同版本类型', async () => {
      githubPlugin(mockApi as unknown as Api)
      const onReleaseHandler = mockApi.onRelease.mock
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
