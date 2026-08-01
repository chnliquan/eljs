import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest'
import * as importedModule0 from '../../src/cp'
import * as importedModule2 from '../../src/git/refs'
import * as importedModule1 from '../../src/guards'

import { gitCommit, gitPush, gitTag } from '../../src/git/operations'

const requiredModule0 = vi.mocked(importedModule0, { deep: true })
const requiredModule2 = vi.mocked(importedModule2, { deep: true })
const requiredModule1 = vi.mocked(importedModule1, { deep: true })

// Mock 依赖项
vi.mock('../../src/cp')
vi.mock('../../src/guards')
vi.mock('../../src/git/refs')

describe('Git 操作工具', () => {
  const mockRun = requiredModule0.run as MockedFunction<
    (
      command: string,
      args: string[],
      options?: unknown,
    ) => Promise<{ stdout: string }>
  >
  const mockIsObject = requiredModule1.isObject as MockedFunction<
    (value: unknown) => boolean
  >
  const mockGetGitBranch = requiredModule2.getGitBranch as MockedFunction<
    (options?: unknown) => Promise<string>
  >
  const mockGetGitUpstreamBranch =
    requiredModule2.getGitUpstreamBranch as MockedFunction<
      (options?: unknown) => Promise<string | null>
    >

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mocks
    mockIsObject.mockReturnValue(false)
    mockRun.mockResolvedValue({ stdout: 'success' })
    mockGetGitBranch.mockResolvedValue('main')
    mockGetGitUpstreamBranch.mockResolvedValue('origin/main')
  })

  describe('gitCommit', () => {
    it('应该提交代码并添加所有文件', async () => {
      const message = 'feat: add new feature'

      await gitCommit(message)

      expect(mockRun).toHaveBeenCalledWith('git', ['add', '-A'], undefined)
      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', message],
        undefined,
      )
    })

    it('应该传递额外的commit参数', async () => {
      const message = 'fix: bug fix'
      const args = ['--no-verify', '--author="Test Author <test@example.com>"']
      mockIsObject.mockReturnValue(false)

      await gitCommit(message, args)

      expect(mockRun).toHaveBeenCalledWith('git', ['add', '-A'], undefined)
      expect(mockRun).toHaveBeenCalledWith(
        'git',
        [
          'commit',
          '-m',
          message,
          '--no-verify',
          '--author="Test Author <test@example.com>"',
        ],
        undefined,
      )
    })

    it('应该传递运行选项', async () => {
      const message = 'chore: update dependencies'
      const options = { cwd: '/project/dir', verbose: true }
      mockIsObject.mockReturnValue(true)

      await gitCommit(message, options)

      expect(mockRun).toHaveBeenCalledWith('git', ['add', '-A'], options)
      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', message],
        options,
      )
    })

    it('应该同时处理args和options', async () => {
      const message = 'docs: update README'
      const args = ['--signoff']
      const options = { cwd: '/docs' }
      mockIsObject.mockReturnValue(false)

      await gitCommit(message, args, options)

      expect(mockRun).toHaveBeenCalledWith('git', ['add', '-A'], options)
      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', message, '--signoff'],
        options,
      )
    })

    it('应该在没有变更时忽略"nothing to commit"错误', async () => {
      const message = 'test: no changes'
      mockRun
        .mockResolvedValueOnce({ stdout: 'added files' }) // git add
        .mockRejectedValueOnce(
          new Error('nothing to commit, working tree clean'),
        ) // git commit

      await expect(gitCommit(message)).resolves.toBeUndefined()
    })

    it('应该在没有变更时忽略中文"无文件要提交"错误', async () => {
      const message = 'test: 无变更'
      mockRun
        .mockResolvedValueOnce({ stdout: 'added files' })
        .mockRejectedValueOnce(new Error('无文件要提交，工作区是干净的'))

      await expect(gitCommit(message)).resolves.toBeUndefined()
    })

    it('应该在其他Git错误时抛出增强错误', async () => {
      const message = 'test: will fail'
      mockRun
        .mockResolvedValueOnce({ stdout: 'added files' })
        .mockRejectedValueOnce(new Error('Permission denied'))

      await expect(gitCommit(message)).rejects.toThrow(
        /Git commit failed.*Permission denied/,
      )
    })

    it('应该在git add失败时抛出错误', async () => {
      mockRun.mockRejectedValue(new Error('Git add failed'))

      await expect(gitCommit('test message')).rejects.toThrow('Git add failed')
    })
  })

  describe('gitPush', () => {
    it('应该推送到已存在的上游分支', async () => {
      mockGetGitUpstreamBranch.mockResolvedValue('origin/main')

      await gitPush()

      expect(mockGetGitUpstreamBranch).toHaveBeenCalledWith({ verbose: false })
      expect(mockRun).toHaveBeenCalledWith('git', ['push'], undefined)
    })

    it('应该为新分支设置上游', async () => {
      mockGetGitUpstreamBranch.mockResolvedValue(null) // 没有上游分支
      mockGetGitBranch.mockResolvedValue('feature-branch')

      await gitPush()

      expect(mockGetGitUpstreamBranch).toHaveBeenCalledWith({ verbose: false })
      expect(mockGetGitBranch).toHaveBeenCalledWith({ verbose: false })
      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['push', '--set-upstream', 'origin', 'feature-branch'],
        undefined,
      )
    })

    it('应该传递额外的push参数', async () => {
      const args = ['--force', '--tags']
      mockIsObject.mockReturnValue(false)
      mockGetGitUpstreamBranch.mockResolvedValue('origin/main')

      await gitPush(args)

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['push', '--force', '--tags'],
        undefined,
      )
    })

    it('应该传递运行选项', async () => {
      const options = { cwd: '/git/repo', verbose: true }
      mockIsObject.mockReturnValue(true)
      mockGetGitUpstreamBranch.mockResolvedValue('origin/develop')

      await gitPush(options)

      expect(mockGetGitUpstreamBranch).toHaveBeenCalledWith({
        cwd: '/git/repo',
        verbose: false,
      })
      expect(mockRun).toHaveBeenCalledWith('git', ['push'], options)
    })

    it('应该组合args、upstream设置和options', async () => {
      const args = ['--dry-run']
      const options = { cwd: '/test' }
      mockIsObject.mockReturnValue(false)
      mockGetGitUpstreamBranch.mockResolvedValue(null)
      mockGetGitBranch.mockResolvedValue('new-feature')

      await gitPush(args, options)

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['push', '--dry-run', '--set-upstream', 'origin', 'new-feature'],
        options,
      )
    })

    it('应该在push失败时抛出增强错误', async () => {
      mockRun.mockRejectedValue(new Error('Authentication failed'))

      await expect(gitPush()).rejects.toThrow(
        /Git push failed.*Authentication failed/,
      )
    })

    it('应该在获取分支信息失败时抛出错误', async () => {
      mockGetGitUpstreamBranch.mockRejectedValue(
        new Error('Branch info failed'),
      )

      await expect(gitPush()).rejects.toThrow(
        /Git push failed.*Branch info failed/,
      )
    })

    it('应该正确处理选项传递给分支查询', async () => {
      const options = { cwd: '/custom/path' }
      mockIsObject.mockReturnValue(true)
      mockGetGitUpstreamBranch.mockResolvedValue(null)
      mockGetGitBranch.mockResolvedValue('custom-branch')

      await gitPush(options)

      // 应该传递修改后的选项（verbose: false）给分支查询
      expect(mockGetGitUpstreamBranch).toHaveBeenCalledWith({
        ...options,
        verbose: false,
      })
      expect(mockGetGitBranch).toHaveBeenCalledWith({
        ...options,
        verbose: false,
      })
    })
  })

  describe('gitTag', () => {
    it('应该创建简单的Git标签', async () => {
      const tagName = 'v1.0.0'

      await gitTag(tagName)

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['tag', tagName, '-m', tagName],
        undefined,
      )
    })

    it('应该传递额外的tag参数', async () => {
      const tagName = 'v2.0.0'
      const args = ['--force', '--annotate']
      mockIsObject.mockReturnValue(false)

      await gitTag(tagName, args)

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['tag', tagName, '-m', tagName, '--force', '--annotate'],
        undefined,
      )
    })

    it('应该传递运行选项', async () => {
      const tagName = 'v1.5.0'
      const options = { cwd: '/release/dir' }
      mockIsObject.mockReturnValue(true)

      await gitTag(tagName, options)

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['tag', tagName, '-m', tagName],
        options,
      )
    })

    it('应该同时处理args和options', async () => {
      const tagName = 'v3.0.0-beta'
      const args = ['--sign']
      const options = { verbose: false }
      mockIsObject.mockReturnValue(false)

      await gitTag(tagName, args, options)

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['tag', tagName, '-m', tagName, '--sign'],
        options,
      )
    })

    it('应该在tag创建失败时抛出增强错误', async () => {
      const tagName = 'invalid-tag'
      mockRun.mockRejectedValue(new Error('Tag already exists'))

      await expect(gitTag(tagName)).rejects.toThrow(
        /Git Tag failed.*Tag already exists/,
      )
    })

    it('应该处理复杂的标签名', async () => {
      const complexTagName = 'release/v1.0.0-rc.1+build.123'

      await gitTag(complexTagName)

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['tag', complexTagName, '-m', complexTagName],
        undefined,
      )
    })

    it('应该处理空的args数组', async () => {
      const tagName = 'v1.1.0'
      const emptyArgs: string[] = []
      mockIsObject.mockReturnValue(false)

      await gitTag(tagName, emptyArgs)

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['tag', tagName, '-m', tagName],
        undefined,
      )
    })
  })

  describe('参数重载测试', () => {
    it('应该正确处理gitCommit的不同参数形式', async () => {
      // 测试 (message, options)
      mockIsObject.mockReturnValueOnce(true)
      await gitCommit('test1', { cwd: '/test1' })

      // 测试 (message, args, options)
      mockIsObject.mockReturnValueOnce(false).mockReturnValueOnce(false)
      await gitCommit('test2', ['--amend'], { cwd: '/test2' })

      expect(mockRun).toHaveBeenCalledTimes(4) // 每次commit调用2次run（add + commit）
    })

    it('应该正确处理gitPush的不同参数形式', async () => {
      mockGetGitUpstreamBranch.mockResolvedValue('origin/main')

      // 测试 ()
      await gitPush()

      // 测试 (options)
      mockIsObject.mockReturnValueOnce(true)
      await gitPush({ cwd: '/test' })

      // 测试 (args, options)
      mockIsObject.mockReturnValueOnce(false)
      await gitPush(['--tags'], { verbose: true })

      expect(mockRun).toHaveBeenCalledTimes(3)
    })

    it('应该正确处理gitTag的不同参数形式', async () => {
      // 测试 (tagName)
      await gitTag('v1.0.0')

      // 测试 (tagName, options)
      mockIsObject.mockReturnValueOnce(true)
      await gitTag('v1.1.0', { cwd: '/release' })

      // 测试 (tagName, args, options)
      mockIsObject.mockReturnValueOnce(false)
      await gitTag('v1.2.0', ['--force'], { verbose: false })

      expect(mockRun).toHaveBeenCalledTimes(3)
    })
  })

  describe('错误处理和边界情况', () => {
    it('应该处理git命令不可用的情况', async () => {
      mockRun.mockRejectedValue(new Error('git: command not found'))

      await expect(gitCommit('test')).rejects.toThrow(
        /Git commit failed.*command not found/,
      )
      await expect(gitPush()).rejects.toThrow(
        /Git push failed.*command not found/,
      )
      await expect(gitTag('v1.0.0')).rejects.toThrow(
        /Git Tag failed.*command not found/,
      )
    })

    it('应该处理权限错误', async () => {
      mockRun.mockRejectedValue(new Error('Permission denied'))

      await expect(gitCommit('test')).rejects.toThrow(
        /Git commit failed.*Permission denied/,
      )
      await expect(gitPush()).rejects.toThrow(
        /Git push failed.*Permission denied/,
      )
      await expect(gitTag('v1.0.0')).rejects.toThrow(
        /Git Tag failed.*Permission denied/,
      )
    })

    it('应该处理网络错误', async () => {
      mockGetGitUpstreamBranch.mockResolvedValue('origin/main')
      mockRun.mockRejectedValue(new Error('Network timeout'))

      await expect(gitPush()).rejects.toThrow(
        /Git push failed.*Network timeout/,
      )
    })

    it('应该处理空的提交消息', async () => {
      await gitCommit('')

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', ''],
        undefined,
      )
    })

    it('应该处理特殊字符的提交消息', async () => {
      const specialMessage =
        'feat: 添加新功能 🎉 with "quotes" and \'apostrophes\''

      await gitCommit(specialMessage)

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', specialMessage],
        undefined,
      )
    })

    it('应该处理多行提交消息', async () => {
      const multilineMessage =
        'feat: major update\n\n- Added feature A\n- Fixed bug B\n- Updated docs'

      await gitCommit(multilineMessage)

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', multilineMessage],
        undefined,
      )
    })
  })

  describe('复杂工作流测试', () => {
    it('应该模拟完整的发布流程', async () => {
      const commitMessage = 'release: v1.0.0'
      const tagName = 'v1.0.0'
      const pushArgs = ['--tags']

      // 模拟发布流程：commit -> tag -> push
      await gitCommit(commitMessage)
      await gitTag(tagName)
      await gitPush(pushArgs)

      // 验证调用顺序和参数
      expect(mockRun).toHaveBeenCalledWith('git', ['add', '-A'], undefined)
      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', commitMessage],
        undefined,
      )
      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['tag', tagName, '-m', tagName],
        undefined,
      )
      expect(mockRun).toHaveBeenCalledWith('git', ['push', '--tags'], undefined)
    })

    it('应该处理新分支的首次推送', async () => {
      mockGetGitUpstreamBranch.mockResolvedValue(null) // 新分支没有上游
      mockGetGitBranch.mockResolvedValue('feature/new-awesome-feature')

      await gitPush()

      expect(mockGetGitUpstreamBranch).toHaveBeenCalledWith({ verbose: false })
      expect(mockGetGitBranch).toHaveBeenCalledWith({ verbose: false })
      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['push', '--set-upstream', 'origin', 'feature/new-awesome-feature'],
        undefined,
      )
    })

    it('应该在获取分支信息时保持选项一致性', async () => {
      const pushOptions = { cwd: '/project', verbose: true }
      mockIsObject.mockReturnValue(true)
      mockGetGitUpstreamBranch.mockResolvedValue(null)
      mockGetGitBranch.mockResolvedValue('development')

      await gitPush(pushOptions)

      // 分支查询应该使用原选项但设置 verbose: false
      expect(mockGetGitUpstreamBranch).toHaveBeenCalledWith({
        cwd: '/project',
        verbose: false,
      })
      expect(mockGetGitBranch).toHaveBeenCalledWith({
        cwd: '/project',
        verbose: false,
      })

      // 实际push使用原始选项
      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['push', '--set-upstream', 'origin', 'development'],
        pushOptions,
      )
    })
  })

  describe('边界情况和类型安全', () => {
    it('应该处理undefined选项', async () => {
      await gitCommit('test', undefined)
      await gitPush(undefined)
      await gitTag('v1.0.0', undefined)

      // 应该都能正常执行
      expect(mockRun).toHaveBeenCalledTimes(4) // commit(2) + push(1) + tag(1)
    })

    it('应该处理空数组参数', async () => {
      const emptyArgs: string[] = []

      await gitCommit('test', emptyArgs)
      await gitPush(emptyArgs)
      await gitTag('v1.0.0', emptyArgs)

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', 'test'],
        undefined,
      )
      expect(mockRun).toHaveBeenCalledWith('git', ['push'], undefined)
      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['tag', 'v1.0.0', '-m', 'v1.0.0'],
        undefined,
      )
    })

    it('应该维护类型安全的选项传递', async () => {
      const typedOptions = {
        cwd: '/typed/project',
        verbose: true,
        timeout: 30000,
      }

      mockIsObject.mockReturnValue(true)

      await gitCommit('typed commit', typedOptions)

      expect(mockRun).toHaveBeenCalledWith('git', ['add', '-A'], typedOptions)
      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', 'typed commit'],
        typedOptions,
      )
    })
  })

  describe('实际使用场景模拟', () => {
    it('应该模拟CI/CD发布场景', async () => {
      const releaseVersion = '2.1.0'
      const releaseOptions = {
        cwd: '/ci/workspace',
        verbose: false,
      }

      // 模拟CI环境下的发布流程
      await gitCommit(
        `chore: release v${releaseVersion}`,
        ['--no-verify'],
        releaseOptions,
      )
      await gitTag(`v${releaseVersion}`, ['--sign'], releaseOptions)
      await gitPush(['--follow-tags'], releaseOptions)

      expect(mockRun).toHaveBeenCalledWith('git', ['add', '-A'], releaseOptions)
      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', `chore: release v${releaseVersion}`, '--no-verify'],
        releaseOptions,
      )
      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['tag', `v${releaseVersion}`, '-m', `v${releaseVersion}`, '--sign'],
        releaseOptions,
      )
      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['push', '--follow-tags'],
        releaseOptions,
      )
    })

    it('应该模拟hotfix场景', async () => {
      mockGetGitUpstreamBranch.mockResolvedValue(null) // hotfix分支是新的
      mockGetGitBranch.mockResolvedValue('hotfix/critical-bug-fix')

      await gitCommit('fix: critical security vulnerability', ['--gpg-sign'])
      await gitPush(['--force-with-lease'])

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', 'fix: critical security vulnerability', '--gpg-sign'],
        undefined,
      )
      expect(mockRun).toHaveBeenCalledWith(
        'git',
        [
          'push',
          '--force-with-lease',
          '--set-upstream',
          'origin',
          'hotfix/critical-bug-fix',
        ],
        undefined,
      )
    })
  })
})
