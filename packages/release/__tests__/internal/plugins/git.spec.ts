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
import type { Api, Config, PrereleaseId } from '../../../src/types'
import { getChangelog } from '../../../src/utils'

// 定义测试专用的 Mock API 类型，基于源代码类型但适应测试环境
interface GitTestApi {
  onCheck: jest.MockedFunction<
    (
      handler: (args: { releaseTypeOrVersion?: string }) => Promise<void>,
    ) => void
  >
  getChangelog: jest.MockedFunction<
    (
      handler: (args: {
        version: string
        isPrerelease: boolean
        prereleaseId: PrereleaseId | null
      }) => Promise<string>,
      options?: { stage?: number },
    ) => void
  >
  onBeforeRelease: jest.MockedFunction<
    (
      handler: (args: {
        version: string
        isPrerelease: boolean
        prereleaseId: PrereleaseId | null
        changelog: string
      }) => Promise<void>,
    ) => void
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
  step: jest.MockedFunction<(message: string) => void>
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
jest.mock('@eljs/utils', () => ({
  chalk: {
    cyan: jest.fn((text: string) => `[cyan]${text}[/cyan]`),
  },
  gitCommit: jest.fn(),
  gitPush: jest.fn(),
  gitTag: jest.fn(),
  isGitBehindRemote: jest.fn(),
  isGitClean: jest.fn(),
  isPathExists: jest.fn(),
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
  },
  normalizeArgs: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
}))

jest.mock('../../../src/utils', () => ({
  AppError: jest.fn().mockImplementation((message: string) => {
    const error = new Error(message)
    error.name = 'AppError'
    return error
  }),
  getChangelog: jest.fn(),
}))

describe('Git 插件测试', () => {
  let mockApi: GitTestApi

  beforeEach(() => {
    mockApi = {
      onCheck: jest.fn(),
      getChangelog: jest.fn(),
      onBeforeRelease: jest.fn(),
      onRelease: jest.fn(),
      step: jest.fn(),
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

    jest.clearAllMocks()

    // 设置默认的模拟返回值
    ;(isGitClean as jest.MockedFunction<typeof isGitClean>).mockResolvedValue(
      true,
    )
    ;(
      isGitBehindRemote as jest.MockedFunction<typeof isGitBehindRemote>
    ).mockResolvedValue(false)
    ;(
      getChangelog as jest.MockedFunction<typeof getChangelog>
    ).mockResolvedValue('## Changelog\n\n- Feature: Added new functionality')
    ;(
      isPathExists as jest.MockedFunction<typeof isPathExists>
    ).mockResolvedValue(true)
    ;(readFile as jest.MockedFunction<typeof readFile>).mockResolvedValue(
      '# Existing changelog',
    )
    ;(writeFile as jest.MockedFunction<typeof writeFile>).mockResolvedValue(
      undefined,
    )
    ;(gitCommit as jest.MockedFunction<typeof gitCommit>).mockResolvedValue(
      undefined,
    )
    ;(gitTag as jest.MockedFunction<typeof gitTag>).mockResolvedValue(undefined)
    ;(gitPush as jest.MockedFunction<typeof gitPush>).mockResolvedValue(
      undefined,
    )
    ;(
      normalizeArgs as jest.MockedFunction<typeof normalizeArgs>
    ).mockImplementation(args => {
      if (args === undefined) return []
      return Array.isArray(args) ? args : [args]
    })
  })

  describe('插件注册', () => {
    it('应该注册所有必需的钩子方法', () => {
      gitPlugin(mockApi as unknown as Api)

      expect(mockApi.onCheck).toHaveBeenCalledWith(expect.any(Function))
      expect(mockApi.getChangelog).toHaveBeenCalledWith(expect.any(Function), {
        stage: 10,
      })
      expect(mockApi.onBeforeRelease).toHaveBeenCalledWith(expect.any(Function))
      expect(mockApi.onRelease).toHaveBeenCalledWith(expect.any(Function))
    })
  })

  describe('onCheck 钩子测试', () => {
    type OnCheckHandler = (args: {
      releaseTypeOrVersion?: string
    }) => Promise<void>
    let onCheckHandler: OnCheckHandler

    beforeEach(() => {
      gitPlugin(mockApi as unknown as Api)
      onCheckHandler = mockApi.onCheck?.mock.calls[0][0] as OnCheckHandler
    })

    it('应该检查 Git 工作树是否干净', async () => {
      await onCheckHandler({ releaseTypeOrVersion: 'minor' })

      expect(isGitClean).toHaveBeenCalledWith({
        cwd: '/it/project',
        verbose: true,
      })
    })

    it('当树不干净时应该抛出错误', async () => {
      ;(isGitClean as jest.MockedFunction<typeof isGitClean>).mockResolvedValue(
        false,
      )

      await expect(
        onCheckHandler({ releaseTypeOrVersion: 'minor' }),
      ).rejects.toThrow('Git working tree is not clean.')
    })

    it('当 Git 落后于远程时应该抛出错误', async () => {
      ;(
        isGitBehindRemote as jest.MockedFunction<typeof isGitBehindRemote>
      ).mockResolvedValue(true)

      await expect(
        onCheckHandler({ releaseTypeOrVersion: 'minor' }),
      ).rejects.toThrow('Git working tree is behind remote.')
    })

    it('应该检查指定分支', async () => {
      mockApi.config.git!.requireBranch = 'main'
      mockApi.appData.branch = 'develop'

      await expect(
        onCheckHandler({ releaseTypeOrVersion: 'minor' }),
      ).rejects.toThrow('Require branch main`, but got [cyan]develop[/cyan].')
    })

    it('当分支匹配时应该正常通过', async () => {
      mockApi.config.git!.requireBranch = 'main'
      mockApi.appData.branch = 'main'

      await expect(
        onCheckHandler({ releaseTypeOrVersion: 'minor' }),
      ).resolves.toBeUndefined()
    })

    it('当不需要检查清洁度时应该跳过检查', async () => {
      mockApi.config.git!.requireClean = false

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
      gitPlugin(mockApi as unknown as Api)
      getChangelogHandler = mockApi.getChangelog?.mock
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
      mockApi.config.git!.independent = true

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
      mockApi.config.git!.changelog = false

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
      gitPlugin(mockApi as unknown as Api)
      onBeforeReleaseHandler = mockApi.onBeforeRelease?.mock
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
      mockApi.config.git!.changelog = false

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
      ;(
        isPathExists as jest.MockedFunction<typeof isPathExists>
      ).mockResolvedValue(false)

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
      ;(mockApi.config.git!.changelog as { filename: string }).filename =
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onReleaseHandler: OnReleaseHandler

    beforeEach(() => {
      gitPlugin(mockApi as unknown as Api)
      onReleaseHandler = mockApi.onRelease?.mock.calls[0][0] as OnReleaseHandler
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
      mockApi.config.git!.commit = false

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
      mockApi.config.git!.push = false

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
      mockApi.config.git!.independent = true

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
      mockApi.appData.latestTag = 'v1.1.0' // 设置 latestTag 以匹配条件
      const tagError = new Error("tag 'v1.1.0' already exists")
      ;(gitTag as jest.MockedFunction<typeof gitTag>).mockRejectedValue(
        tagError,
      )

      const releaseInfo = {
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog: '## Changes',
      }

      // 标签已存在的错误应该被忽略
      await expect(onReleaseHandler(releaseInfo)).resolves.toBeUndefined()
    })

    it('应该传播非标签存在的错误', async () => {
      const otherError = new Error('network error')
      ;(gitTag as jest.MockedFunction<typeof gitTag>).mockRejectedValue(
        otherError,
      )

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onReleaseHandler: OnReleaseHandler

    beforeEach(() => {
      gitPlugin(mockApi as unknown as Api)
      onReleaseHandler = mockApi.onRelease?.mock.calls[0][0] as OnReleaseHandler
    })

    it('应该使用自定义提交参数', async () => {
      mockApi.config.git!.commitArgs = '--no-verify'

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
      mockApi.config.git!.pushArgs = ['--force', '--tags']

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
      mockApi.config.git!.commitArgs = []
      mockApi.config.git!.pushArgs = []

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onReleaseHandler: OnReleaseHandler

    beforeEach(() => {
      gitPlugin(mockApi as unknown as Api)
      onReleaseHandler = mockApi.onRelease?.mock.calls[0][0] as OnReleaseHandler
    })

    it('应该处理 Git 提交失败', async () => {
      ;(gitCommit as jest.MockedFunction<typeof gitCommit>).mockRejectedValue(
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
      ;(gitPush as jest.MockedFunction<typeof gitPush>).mockRejectedValue(
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onBeforeReleaseHandler: OnBeforeReleaseHandler

    beforeEach(() => {
      gitPlugin(mockApi as unknown as Api)
      onBeforeReleaseHandler = mockApi.onBeforeRelease?.mock
        .calls[0][0] as OnBeforeReleaseHandler
    })

    it('应该处理文件写入失败', async () => {
      ;(writeFile as jest.MockedFunction<typeof writeFile>).mockRejectedValue(
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
      const result = gitPlugin(mockApi as unknown as Api)
      expect(result).toBeUndefined()
    })
  })

  describe('完整工作流测试', () => {
    it('应该完整执行 Git 插件工作流', async () => {
      gitPlugin(mockApi as unknown as Api)

      // 1. 检查 Git 状态
      const onCheckHandler = mockApi.onCheck?.mock.calls[0][0] as OnCheckHandler
      await onCheckHandler({ releaseTypeOrVersion: 'minor' })
      expect(isGitClean).toHaveBeenCalled()

      // 2. 生成变更日志
      const getChangelogHandler = mockApi.getChangelog?.mock
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
      const onBeforeReleaseHandler = mockApi.onBeforeRelease?.mock
        .calls[0][0] as OnBeforeReleaseHandler
      await onBeforeReleaseHandler({
        version: '1.1.0',
        isPrerelease: false,
        prereleaseId: null,
        changelog,
      })
      expect(writeFile).toHaveBeenCalled()

      // 4. 提交和推送
      const onReleaseHandler = mockApi.onRelease?.mock
        .calls[0][0] as OnReleaseHandler
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
      mockApi.config.git!.commitMessage = 'release: v${version}'

      gitPlugin(mockApi as unknown as Api)
      const onReleaseHandler = mockApi.onRelease?.mock
        .calls[0][0] as OnReleaseHandler

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
      mockApi.config.git!.commitArgs = '--no-verify'
      mockApi.config.git!.pushArgs = '--force'

      gitPlugin(mockApi as unknown as Api)
      const onReleaseHandler = mockApi.onRelease?.mock
        .calls[0][0] as OnReleaseHandler

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
        mockApi.config.git = { ...mockApi.config.git, ...config }

        gitPlugin(mockApi as unknown as Api)
        const onReleaseHandler = mockApi.onRelease?.mock
          .calls[0][0] as OnReleaseHandler

        await expect(
          onReleaseHandler({
            version: '1.1.0',
            isPrerelease: false,
            prereleaseId: null,
            changelog: '## Changes',
          }),
        ).resolves.toBeUndefined()

        jest.clearAllMocks()
      }
    })
  })
})
