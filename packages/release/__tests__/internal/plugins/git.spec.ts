import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest'
/**
 * @file packages/release internal/plugins/git 模块单元测试
 * @description 测试 git.ts Git 相关插件功能
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import {
  gitCommit,
  gitPush,
  gitTag,
  isGitBehindRemote,
  isGitClean,
  isPathExists,
  normalizeArgs,
  readFile,
  writeFile,
} from '@eljs/utils'

import gitPlugin from '../../../src/internal/plugins/git'
import type {
  Config,
  PrereleaseId,
  ReleasePluginContext,
} from '../../../src/types'
import { getChangelog, isGitTagAtHead } from '../../../src/utils'

// 定义测试专用的 Mock API 类型，基于源代码类型但适应测试环境
interface GitTestApi {
  onCheck: MockedFunction<
    (
      handler: (args: { releaseTypeOrVersion?: string }) => Promise<void>,
    ) => void
  >
  getChangelog: MockedFunction<
    (
      handler: (args: {
        version: string
        isPrerelease: boolean
        prereleaseId: PrereleaseId | null
      }) => Promise<string>,
      options?: { stage?: number },
    ) => void
  >
  onBeforeRelease: MockedFunction<
    (
      handler: (args: {
        version: string
        isPrerelease: boolean
        prereleaseId: PrereleaseId | null
        changelog: string
      }) => Promise<void>,
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
    cliVersion: string
    registry: string
    branch: string
    latestTag: string | null
    projectPkgJsonPath: string
    projectPkg: { name: string; version: string; private: boolean }
    pkgJsonPaths: string[]
    pkgs: Array<{ name: string; version: string; private: boolean }>
    pkgNames: string[]
    validPkgRootPaths: string[]
    validPkgNames: string[]
    packageManager: string
  }
  cwd: string
}

// 全局类型定义
type OnCheckHandler = (args: { releaseTypeOrVersion?: string }) => Promise<void>
type GetChangelogHandler = (args: {
  version: string
  isPrerelease: boolean
  prereleaseId: PrereleaseId | null
}) => Promise<string>
type OnBeforeReleaseHandler = (args: {
  version: string
  isPrerelease: boolean
  prereleaseId: PrereleaseId | null
  changelog: string
}) => Promise<void>
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
  },
  gitCommit: vi.fn(),
  gitPush: vi.fn(),
  gitTag: vi.fn(),
  isGitBehindRemote: vi.fn(),
  isGitClean: vi.fn(),
  isPathExists: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
  normalizeArgs: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}))

vi.mock('../../../src/utils', () => ({
  AppError: class AppError extends Error {
    public constructor(message: string) {
      super(message)
      this.name = 'AppError'
    }
  },
  getChangelog: vi.fn(),
  isGitTagAtHead: vi.fn(),
}))

describe('Git 插件测试', () => {
  let mockContext: GitTestApi

  const getOnReleaseHandler = (): OnReleaseHandler => {
    const handlers = mockContext.onRelease.mock.calls
      .slice(-2)
      .map(call => call[0] as OnReleaseHandler)

    return async args => {
      for (const handler of handlers) {
        await handler(args)
      }
    }
  }

  beforeEach(() => {
    mockContext = {
      onCheck: vi.fn(),
      getChangelog: vi.fn(),
      onBeforeRelease: vi.fn(),
      onRelease: vi.fn(),
      step: vi.fn(),
      config: {
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
        npm: {
          requireOwner: true,
          prerelease: false,
          canary: false,
          confirm: true,
          publishArgs: [],
        },
        github: {
          release: true,
        },
      } as Config,
      appData: {
        cliVersion: '1.0.0',
        registry: 'https://registry.npmjs.org',
        branch: 'main',
        latestTag: null,
        projectPkgJsonPath: '/it/package.json',
        projectPkg: { name: 'it-project', version: '1.0.0', private: false },
        pkgJsonPaths: ['/it/package.json'],
        pkgs: [{ name: 'it-package', version: '1.0.0', private: false }],
        pkgNames: ['it-package'],
        validPkgRootPaths: ['/it'],
        validPkgNames: ['it-package'],
        packageManager: 'npm',
      },
      cwd: '/it/project',
    }

    vi.clearAllMocks()

    // 设置默认的模拟返回值
    ;(isGitClean as MockedFunction<typeof isGitClean>).mockResolvedValue(true)
    ;(
      isGitBehindRemote as MockedFunction<typeof isGitBehindRemote>
    ).mockResolvedValue(false)
    ;(getChangelog as MockedFunction<typeof getChangelog>).mockResolvedValue(
      '## Changelog\n\n- Feature: Added new functionality',
    )
    ;(isPathExists as MockedFunction<typeof isPathExists>).mockResolvedValue(
      true,
    )
    ;(readFile as MockedFunction<typeof readFile>).mockResolvedValue(
      '# Existing changelog',
    )
    ;(writeFile as MockedFunction<typeof writeFile>).mockResolvedValue(
      undefined,
    )
    ;(gitCommit as MockedFunction<typeof gitCommit>).mockResolvedValue(
      undefined,
    )
    ;(gitTag as MockedFunction<typeof gitTag>).mockResolvedValue(undefined)
    ;(gitPush as MockedFunction<typeof gitPush>).mockResolvedValue(undefined)
    ;(normalizeArgs as MockedFunction<typeof normalizeArgs>).mockImplementation(
      args => {
        if (args === undefined) return []
        return Array.isArray(args) ? args : [args]
      },
    )
  })

  describe('插件注册', () => {
    it('应该注册所有必需的钩子方法', () => {
      gitPlugin(mockContext as unknown as ReleasePluginContext)

      expect(mockContext.onCheck).toHaveBeenCalledWith(expect.any(Function))
      expect(mockContext.getChangelog).toHaveBeenCalledWith(
        expect.any(Function),
        {
          stage: 10,
        },
      )
      expect(mockContext.onBeforeRelease).toHaveBeenCalledWith(
        expect.any(Function),
      )
      expect(mockContext.onRelease).toHaveBeenNthCalledWith(
        1,
        expect.any(Function),
        {
          stage: -10,
        },
      )
      expect(mockContext.onRelease).toHaveBeenNthCalledWith(
        2,
        expect.any(Function),
        {
          stage: 10,
        },
      )
    })
  })

  describe('onCheck 钩子测试', () => {
    type OnCheckHandler = (args: {
      releaseTypeOrVersion?: string
    }) => Promise<void>
    let onCheckHandler: OnCheckHandler

    beforeEach(() => {
      gitPlugin(mockContext as unknown as ReleasePluginContext)
      onCheckHandler = mockContext.onCheck?.mock.calls[0][0] as OnCheckHandler
    })

    it('应该检查 Git 工作树是否干净', async () => {
      await onCheckHandler({ releaseTypeOrVersion: 'minor' })

      expect(isGitClean).toHaveBeenCalledWith({
        cwd: '/it/project',
        verbose: true,
      })
    })

    it('当树不干净时应该抛出错误', async () => {
      ;(isGitClean as MockedFunction<typeof isGitClean>).mockResolvedValue(
        false,
      )

      await expect(
        onCheckHandler({ releaseTypeOrVersion: 'minor' }),
      ).rejects.toThrow('Git working tree is not clean.')
    })

    it('当 Git 落后于远程时应该抛出错误', async () => {
      ;(
        isGitBehindRemote as MockedFunction<typeof isGitBehindRemote>
      ).mockResolvedValue(true)

      await expect(
        onCheckHandler({ releaseTypeOrVersion: 'minor' }),
      ).rejects.toThrow('Git working tree is behind remote.')
    })

    it('应该检查指定分支', async () => {
      mockContext.config.git!.requireBranch = 'main'
      mockContext.appData.branch = 'develop'

      await expect(
        onCheckHandler({ releaseTypeOrVersion: 'minor' }),
      ).rejects.toThrow('Require branch main`, but got [cyan]develop[/cyan].')
    })

    it('当分支匹配时应该正常通过', async () => {
      mockContext.config.git!.requireBranch = 'main'
      mockContext.appData.branch = 'main'

      await expect(
        onCheckHandler({ releaseTypeOrVersion: 'minor' }),
      ).resolves.toBeUndefined()
    })

    it('当不需要检查清洁度时应该跳过检查', async () => {
      mockContext.config.git!.requireClean = false

      await onCheckHandler({ releaseTypeOrVersion: 'minor' })

      expect(isGitClean).not.toHaveBeenCalled()
    })
  })

  describe('getChangelog 钩子测试', () => {
    type GetChangelogHandler = (args: {
      version: string
      isPrerelease: boolean
      prereleaseId: PrereleaseId | null
    }) => Promise<string>
    let getChangelogHandler: GetChangelogHandler

    beforeEach(() => {
      gitPlugin(mockContext as unknown as ReleasePluginContext)
      getChangelogHandler = mockContext.getChangelog?.mock
        .calls[0][0] as GetChangelogHandler
    })

    it('应该生成变更日志', async () => {
      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
      }

      const result = await getChangelogHandler(versionInfo)

      expect(getChangelog).toHaveBeenCalledWith({
        cwd: '/it/project',
        filename: 'CHANGELOG.md',
        independent: false,
        placeholder: '**Note:** No changes, only version bump.',
        preset: '@eljs/conventional-changelog-preset',
      })
      expect(result).toBe('## Changelog\n\n- Feature: Added new functionality')
    })

    it('应该使用独立模式', async () => {
      mockContext.config.git!.independent = true

      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
      }

      await getChangelogHandler(versionInfo)

      expect(getChangelog).toHaveBeenCalledWith({
        cwd: '/it/project',
        filename: 'CHANGELOG.md',
        independent: true,
        placeholder: '**Note:** No changes, only version bump.',
        preset: '@eljs/conventional-changelog-preset',
      })
    })

    it('当禁用变更日志时应该返回空字符串', async () => {
      mockContext.config.git!.changelog = false

      const versionInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
      }

      const result = await getChangelogHandler(versionInfo)

      expect(getChangelog).not.toHaveBeenCalled()
      expect(result).toBe('')
    })
  })

  describe('onBeforeRelease 钩子测试（变更日志文件处理）', () => {
    type OnBeforeReleaseHandler = (args: {
      version: string
      isPrerelease: boolean
      prereleaseId: PrereleaseId | null
      changelog: string
    }) => Promise<void>
    let onBeforeReleaseHandler: OnBeforeReleaseHandler

    beforeEach(() => {
      gitPlugin(mockContext as unknown as ReleasePluginContext)
      onBeforeReleaseHandler = mockContext.onBeforeRelease?.mock
        .calls[0][0] as OnBeforeReleaseHandler
    })

    it('应该更新变更日志文件', async () => {
      const releaseInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## [1.1.0] - 2023-11-13\n\n- Added new feature',
      }

      await onBeforeReleaseHandler(releaseInfo)

      expect(readFile).toHaveBeenCalledWith('/it/project/CHANGELOG.md')
      expect(writeFile).toHaveBeenCalledWith(
        '/it/project/CHANGELOG.md',
        '# Existing changelog',
      )
    })

    it('当禁用变更日志时不应该更新文件', async () => {
      mockContext.config.git!.changelog = false

      const releaseInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      await onBeforeReleaseHandler(releaseInfo)

      expect(readFile).not.toHaveBeenCalled()
      expect(writeFile).not.toHaveBeenCalled()
    })

    it('应该处理变更日志文件不存在的情况', async () => {
      ;(isPathExists as MockedFunction<typeof isPathExists>).mockResolvedValue(
        false,
      )

      const releaseInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## [1.1.0] - 2023-11-13\n\n- Added new feature',
      }

      await onBeforeReleaseHandler(releaseInfo)

      expect(readFile).not.toHaveBeenCalled()
      expect(writeFile).toHaveBeenCalledWith(
        '/it/project/CHANGELOG.md',
        expect.stringContaining('## [1.1.0] - 2023-11-13'),
      )
    })

    it('应该使用自定义文件名', async () => {
      ;(mockContext.config.git!.changelog as { filename: string }).filename =
        'HISTORY.md'

      const releaseInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      await onBeforeReleaseHandler(releaseInfo)

      expect(writeFile).toHaveBeenCalledWith(
        '/it/project/HISTORY.md',
        expect.any(String),
      )
    })
  })

  describe('onRelease 钩子测试', () => {
    let onReleaseHandler: OnReleaseHandler

    beforeEach(() => {
      gitPlugin(mockContext as unknown as ReleasePluginContext)
      onReleaseHandler = getOnReleaseHandler()
    })

    it('应该提交更改', async () => {
      const releaseInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      await onReleaseHandler(releaseInfo)

      expect(gitCommit).toHaveBeenCalledWith('chore: bump version v1.1.0', [], {
        cwd: '/it/project',
        verbose: true,
      })
    })

    it('应该创建 Git 标签', async () => {
      const releaseInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      await onReleaseHandler(releaseInfo)

      expect(gitTag).toHaveBeenCalledWith('v1.1.0', {
        cwd: '/it/project',
        verbose: true,
      })
    })

    it('应该推送到远程', async () => {
      const releaseInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      await onReleaseHandler(releaseInfo)

      expect(gitPush).toHaveBeenCalledWith(['--follow-tags'], {
        cwd: '/it/project',
        verbose: true,
      })
    })

    it('当禁用提交时不应该执行提交', async () => {
      mockContext.config.git!.commit = false

      const releaseInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      await onReleaseHandler(releaseInfo)

      expect(gitCommit).not.toHaveBeenCalled()
    })

    it('当禁用推送时不应该推送', async () => {
      mockContext.config.git!.push = false

      const releaseInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      await onReleaseHandler(releaseInfo)

      expect(gitPush).not.toHaveBeenCalled()
    })

    it('应该在独立模式下创建包特定标签', async () => {
      mockContext.config.git!.independent = true

      const releaseInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      await onReleaseHandler(releaseInfo)

      expect(gitTag).toHaveBeenCalledWith('it-package@1.1.0', {
        cwd: '/it/project',
        verbose: true,
      })
    })

    it('应该处理标签已存在的情况', async () => {
      const tagError = new Error("tag 'v1.1.0' already exists")
      ;(gitTag as MockedFunction<typeof gitTag>).mockRejectedValue(tagError)
      ;(
        isGitTagAtHead as MockedFunction<typeof isGitTagAtHead>
      ).mockResolvedValue(true)

      const releaseInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      // 标签已存在的错误应该被忽略
      await expect(onReleaseHandler(releaseInfo)).resolves.toBeUndefined()
    })

    it('标签已存在但不指向 HEAD 时应该拒绝重用', async () => {
      const tagError = new Error("tag 'v1.1.0' already exists")
      ;(gitTag as MockedFunction<typeof gitTag>).mockRejectedValue(tagError)
      ;(
        isGitTagAtHead as MockedFunction<typeof isGitTagAtHead>
      ).mockResolvedValue(false)

      await expect(
        onReleaseHandler({
          version: '1.1.0',
          isPrerelease: false,
          prereleaseId: null,
          changelog: '## Changes',
        }),
      ).rejects.toThrow("tag 'v1.1.0' already exists")
    })

    it('应该传播非标签存在的错误', async () => {
      const otherError = new Error('network error')
      ;(gitTag as MockedFunction<typeof gitTag>).mockRejectedValue(otherError)

      const releaseInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      await expect(onReleaseHandler(releaseInfo)).rejects.toThrow(
        'network error',
      )
    })
  })

  describe('Git 命令参数处理', () => {
    let onReleaseHandler: OnReleaseHandler

    beforeEach(() => {
      gitPlugin(mockContext as unknown as ReleasePluginContext)
      onReleaseHandler = getOnReleaseHandler()
    })

    it('应该使用自定义提交参数', async () => {
      mockContext.config.git!.commitArgs = '--no-verify'

      const releaseInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      await onReleaseHandler(releaseInfo)

      expect(gitCommit).toHaveBeenCalledWith(
        'chore: bump version v1.1.0',
        ['--no-verify'],
        { cwd: '/it/project', verbose: true },
      )
    })

    it('应该使用自定义推送参数', async () => {
      mockContext.config.git!.pushArgs = ['--force', '--tags']

      const releaseInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      await onReleaseHandler(releaseInfo)

      expect(gitPush).toHaveBeenCalledWith(['--force', '--tags'], {
        cwd: '/it/project',
        verbose: true,
      })
    })

    it('应该处理空的命令参数', async () => {
      mockContext.config.git!.commitArgs = []
      mockContext.config.git!.pushArgs = []

      const releaseInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      await onReleaseHandler(releaseInfo)

      expect(gitCommit).toHaveBeenCalledWith('chore: bump version v1.1.0', [], {
        cwd: '/it/project',
        verbose: true,
      })
      expect(gitPush).toHaveBeenCalledWith([], {
        cwd: '/it/project',
        verbose: true,
      })
    })
  })

  describe('Git 插件错误处理', () => {
    let onReleaseHandler: OnReleaseHandler

    beforeEach(() => {
      gitPlugin(mockContext as unknown as ReleasePluginContext)
      onReleaseHandler = getOnReleaseHandler()
    })

    it('应该处理 Git 提交失败', async () => {
      ;(gitCommit as MockedFunction<typeof gitCommit>).mockRejectedValue(
        new Error('commit failed'),
      )

      const releaseInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      await expect(onReleaseHandler(releaseInfo)).rejects.toThrow(
        'commit failed',
      )
    })

    it('应该处理 Git 推送失败', async () => {
      ;(gitPush as MockedFunction<typeof gitPush>).mockRejectedValue(
        new Error('push failed'),
      )

      const releaseInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      await expect(onReleaseHandler(releaseInfo)).rejects.toThrow('push failed')
    })
  })

  describe('变更日志处理集成测试', () => {
    let onBeforeReleaseHandler: OnBeforeReleaseHandler

    beforeEach(() => {
      gitPlugin(mockContext as unknown as ReleasePluginContext)
      onBeforeReleaseHandler = mockContext.onBeforeRelease?.mock
        .calls[0][0] as OnBeforeReleaseHandler
    })

    it('应该处理文件写入失败', async () => {
      ;(writeFile as MockedFunction<typeof writeFile>).mockRejectedValue(
        new Error('write failed'),
      )

      const releaseInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      await expect(onBeforeReleaseHandler(releaseInfo)).rejects.toThrow(
        'write failed',
      )
    })
  })

  describe('插件导出验证', () => {
    it('应该是一个函数', () => {
      expect(typeof gitPlugin).toBe('function')
    })

    it('应该接受 API 参数', () => {
      expect(gitPlugin.length).toBe(1)
    })

    it('应该没有返回值', () => {
      const result = gitPlugin(mockContext as unknown as ReleasePluginContext)
      expect(result).toBeUndefined()
    })
  })

  describe('完整工作流测试', () => {
    it('应该完整执行 Git 插件工作流', async () => {
      gitPlugin(mockContext as unknown as ReleasePluginContext)

      // 1. 检查 Git 状态
      const onCheckHandler = mockContext.onCheck?.mock
        .calls[0][0] as OnCheckHandler
      await onCheckHandler({ releaseTypeOrVersion: 'minor' })
      expect(isGitClean).toHaveBeenCalled()

      // 2. 生成变更日志
      const getChangelogHandler = mockContext.getChangelog?.mock
        .calls[0][0] as GetChangelogHandler
      const changelog = await getChangelogHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
      })
      expect(getChangelog).toHaveBeenCalled()
      expect(changelog).toBe(
        '## Changelog\n\n- Feature: Added new functionality',
      )

      // 3. 更新变更日志文件
      const onBeforeReleaseHandler = mockContext.onBeforeRelease?.mock
        .calls[0][0] as OnBeforeReleaseHandler
      await onBeforeReleaseHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog,
      })
      expect(writeFile).toHaveBeenCalled()

      // 4. 提交和推送
      const onReleaseHandler = getOnReleaseHandler()
      await onReleaseHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog,
      })
      expect(gitCommit).toHaveBeenCalled()
      expect(gitTag).toHaveBeenCalled()
      expect(gitPush).toHaveBeenCalled()
    })
  })

  describe('Git 配置处理验证', () => {
    it('应该正确处理提交消息模板', async () => {
      mockContext.config.git!.commitMessage = 'release: v${version}'

      gitPlugin(mockContext as unknown as ReleasePluginContext)
      const onReleaseHandler = getOnReleaseHandler()

      await onReleaseHandler({
        version: '2.0.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      })

      expect(gitCommit).toHaveBeenCalledWith('release: v2.0.0', [], {
        cwd: '/it/project',
        verbose: true,
      })
    })

    it('应该处理不同类型的参数格式', async () => {
      mockContext.config.git!.commitArgs = '--no-verify'
      mockContext.config.git!.pushArgs = '--force'

      gitPlugin(mockContext as unknown as ReleasePluginContext)
      const onReleaseHandler = getOnReleaseHandler()

      await onReleaseHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      })

      expect(gitCommit).toHaveBeenCalledWith(
        'chore: bump version v1.1.0',
        ['--no-verify'],
        { cwd: '/it/project', verbose: true },
      )
      expect(gitPush).toHaveBeenCalledWith(['--force'], {
        cwd: '/it/project',
        verbose: true,
      })
    })

    it('应该处理多种配置组合', async () => {
      const configurations = [
        { commit: true, push: true, independent: false },
        { commit: false, push: true, independent: false },
        { commit: true, push: false, independent: false },
        { commit: true, push: true, independent: true },
      ]

      for (const config of configurations) {
        mockContext.config.git = { ...mockContext.config.git, ...config }

        gitPlugin(mockContext as unknown as ReleasePluginContext)
        const onReleaseHandler = getOnReleaseHandler()

        await expect(
          onReleaseHandler({
            version: '1.1.0',
            isPrerelease: false,
            prereleaseId: null,
            changelog: '## Changes',
          }),
        ).resolves.toBeUndefined()

        vi.clearAllMocks()
      }
    })
  })
})
