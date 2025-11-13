/* eslint-disable @typescript-eslint/no-var-requires */
import type { ExecaReturnValue } from 'execa'
import execa from 'execa'
import ini from 'ini'
import path from 'node:path'

import {
  downloadGitRepository,
  getGitBranch,
  getGitCommitSha,
  getGitUrl,
  getGitUser,
  gitCommit,
  gitPush,
  gitTag,
  gitUrlAnalysis,
  hasGit,
  hasProjectGit,
  isGitAheadRemote,
  isGitBehindRemote,
  isGitClean,
  type GitRemoteRepository,
} from '../../src/git'

// Mock 依赖项
jest.mock('execa')
jest.mock('ini')
jest.mock('../../src/env')
jest.mock('../../src/cp')
jest.mock('../../src/file')
jest.mock('../../src/type')

describe('Git 工具函数', () => {
  const mockExeca = execa as jest.MockedFunction<typeof execa>
  const mockIni = ini as jest.Mocked<typeof ini>
  const mockHasGlobalInstallation = require('../../src/env')
    .hasGlobalInstallation as jest.Mock<Promise<boolean>, [string]>
  const mockRun = require('../../src/cp').run as jest.Mock<
    Promise<ExecaReturnValue>,
    [string, string[]?, object?]
  >
  const mockIsPathExists = require('../../src/file').isPathExists as jest.Mock<
    Promise<boolean>,
    [string]
  >
  const mockReadFile = require('../../src/file').readFile as jest.Mock<
    Promise<string>,
    [string]
  >
  const mockTmpdir = require('../../src/file').tmpdir as jest.Mock<
    Promise<string>,
    []
  >
  const mockIsObject = require('../../src/type').isObject as jest.Mock<
    boolean,
    [unknown]
  >

  beforeEach(() => {
    jest.clearAllMocks()
    mockIsObject.mockImplementation(
      value =>
        value !== null && typeof value === 'object' && !Array.isArray(value),
    )
  })

  describe('环境检测', () => {
    describe('hasGit 检查全局 Git', () => {
      it('应该在 Git 全局安装时返回 true', async () => {
        mockHasGlobalInstallation.mockResolvedValue(true)

        const result = await hasGit()

        expect(result).toBe(true)
        expect(mockHasGlobalInstallation).toHaveBeenCalledWith('git')
      })

      it('应该在 Git 未安装时返回 false', async () => {
        mockHasGlobalInstallation.mockResolvedValue(false)

        const result = await hasGit()

        expect(result).toBe(false)
      })
    })

    describe('hasProjectGit 检查项目 Git', () => {
      it('应该在项目有 Git 时返回 true', async () => {
        mockExeca.mockResolvedValue({
          stdout: 'On branch main',
          stderr: '',
          exitCode: 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        const result = await hasProjectGit('/project/path')

        expect(result).toBe(true)
        expect(mockExeca).toHaveBeenCalledWith('git', ['status'], {
          cwd: '/project/path',
        })
      })

      it('应该在项目没有 Git 时返回 false', async () => {
        mockExeca.mockRejectedValue(new Error('不是 git 仓库'))

        const result = await hasProjectGit('/project/path')

        expect(result).toBe(false)
      })

      it('应该在 Git 状态返回空时返回 false', async () => {
        mockExeca.mockResolvedValue({
          stdout: '',
          stderr: '',
          exitCode: 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        const result = await hasProjectGit('/project/path')

        expect(result).toBe(false)
      })
    })
  })

  describe('状态检查', () => {
    describe('isGitClean 检查 Git 是否干净', () => {
      it('应该在 Git 干净时返回 true', async () => {
        mockRun.mockResolvedValue({
          stdout: '',
          stderr: '',
          exitCode: 0,
        } as ExecaReturnValue)

        const result = await isGitClean()

        expect(result).toBe(true)
        expect(mockRun).toHaveBeenCalledWith(
          'git',
          ['status', '--porcelain'],
          undefined,
        )
      })

      it('应该在 Git 有变更时返回 false', async () => {
        mockRun.mockResolvedValue({
          stdout: ' M file.js\n?? new-file.js',
          stderr: '',
          exitCode: 0,
        } as ExecaReturnValue)

        const result = await isGitClean()

        expect(result).toBe(false)
      })

      it('应该在 Git 命令错误时返回 false', async () => {
        mockRun.mockRejectedValue(new Error('不是 git 仓库'))

        const result = await isGitClean()

        expect(result).toBe(false)
      })
    })

    describe('isGitBehindRemote 检查是否落后远程', () => {
      it('应该在落后远程时返回 true', async () => {
        mockRun
          .mockResolvedValueOnce({
            stdout: '',
            stderr: '',
            exitCode: 0,
          } as ExecaReturnValue) // git fetch
          .mockResolvedValueOnce({
            stdout: '## main...origin/main [behind 2]',
            stderr: '',
            exitCode: 0,
          } as ExecaReturnValue) // git status

        const result = await isGitBehindRemote()

        expect(result).toBe(true)
      })

      it('应该在不落后远程时返回 false', async () => {
        mockRun
          .mockResolvedValueOnce({
            stdout: '',
            stderr: '',
            exitCode: 0,
          } as ExecaReturnValue) // git fetch
          .mockResolvedValueOnce({
            stdout: '## main...origin/main',
            stderr: '',
            exitCode: 0,
          } as ExecaReturnValue) // git status

        const result = await isGitBehindRemote()

        expect(result).toBe(false)
      })

      it('应该处理中文字符', async () => {
        mockRun
          .mockResolvedValueOnce({
            stdout: '',
            stderr: '',
            exitCode: 0,
          } as ExecaReturnValue)
          .mockResolvedValueOnce({
            stdout: '## main...origin/main [落后 3]',
            stderr: '',
            exitCode: 0,
          } as ExecaReturnValue)

        const result = await isGitBehindRemote()

        expect(result).toBe(true)
      })
    })

    describe('isGitAheadRemote 检查是否超前远程', () => {
      it('应该在超前远程时返回 true', async () => {
        mockRun
          .mockResolvedValueOnce({
            stdout: '',
            stderr: '',
            exitCode: 0,
          } as ExecaReturnValue) // git fetch
          .mockResolvedValueOnce({
            stdout: '## main...origin/main [ahead 1]',
            stderr: '',
            exitCode: 0,
          } as ExecaReturnValue) // git status

        const result = await isGitAheadRemote()

        expect(result).toBe(true)
      })

      it('应该在不超前远程时返回 false', async () => {
        mockRun
          .mockResolvedValueOnce({
            stdout: '',
            stderr: '',
            exitCode: 0,
          } as ExecaReturnValue) // git fetch
          .mockResolvedValueOnce({
            stdout: '## main...origin/main',
            stderr: '',
            exitCode: 0,
          } as ExecaReturnValue) // git status

        const result = await isGitAheadRemote()

        expect(result).toBe(false)
      })
    })
  })

  describe('元数据', () => {
    describe('getGitUrl 获取 Git URL', () => {
      it('应该从配置返回 Git URL', async () => {
        mockIsPathExists.mockResolvedValue(true)
        mockReadFile.mockResolvedValue(`
[core]
    repositoryformatversion = 0
[remote "origin"]
    url = https://github.com/user/repo.git
    fetch = +refs/heads/*:refs/remotes/origin/*
`)
        mockIni.parse.mockReturnValue({
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'remote "origin"': {
            url: 'https://github.com/user/repo.git',
          },
        })

        const result = await getGitUrl('/project')

        expect(result).toBe('https://github.com/user/repo.git')
      })

      it('应该在没有 Git 目录时返回空字符串', async () => {
        mockIsPathExists.mockResolvedValue(false)

        const result = await getGitUrl('/project')

        expect(result).toBe('')
      })
    })

    describe('getGitBranch 获取 Git 分支', () => {
      it('应该返回当前分支', async () => {
        mockRun.mockResolvedValue({
          stdout: 'main\n',
          stderr: '',
          exitCode: 0,
        } as ExecaReturnValue)

        const result = await getGitBranch()

        expect(result).toBe('main')
        expect(mockRun).toHaveBeenCalledWith(
          'git',
          ['rev-parse', '--abbrev-ref', 'HEAD'],
          undefined,
        )
      })
    })

    describe('getGitCommitSha 获取提交哈希', () => {
      it('应该返回完整的提交哈希', async () => {
        mockRun.mockResolvedValue({
          stdout: 'abc123def456\n',
          stderr: '',
          exitCode: 0,
        } as ExecaReturnValue)

        const result = await getGitCommitSha()

        expect(result).toBe('abc123def456')
        expect(mockRun).toHaveBeenCalledWith(
          'git',
          ['rev-parse', 'HEAD'],
          undefined,
        )
      })

      it('应该返回短提交哈希', async () => {
        mockRun.mockResolvedValue({
          stdout: 'abc123d\n',
          stderr: '',
          exitCode: 0,
        } as ExecaReturnValue)

        const result = await getGitCommitSha(true)

        expect(result).toBe('abc123d')
        expect(mockRun).toHaveBeenCalledWith(
          'git',
          ['rev-parse', '--short', 'HEAD'],
          undefined,
        )
      })
    })

    describe('gitUrlAnalysis Git URL 解析', () => {
      it('应该解析 SSH Git URL', () => {
        const url = 'git@github.com:user/repo.git'
        const expected: GitRemoteRepository = {
          name: 'repo',
          group: 'user',
          href: 'https://github.com/user/repo',
          https: 'https://github.com/user/repo.git',
          ssh: 'git@github.com:user/repo.git',
        }

        const result = gitUrlAnalysis(url)

        expect(result).toEqual(expected)
      })

      it('应该解析 HTTPS Git URL', () => {
        const url = 'https://github.com/user/repo.git'
        const expected: GitRemoteRepository = {
          name: 'repo',
          group: 'user',
          href: 'https://github.com/user/repo',
          https: 'https://github.com/user/repo.git',
          ssh: 'git@github.com:user/repo.git',
        }

        const result = gitUrlAnalysis(url)

        expect(result).toEqual(expected)
      })

      it('应该解析带嵌套组的 URL', () => {
        const url = 'git@gitlab.com:group/subgroup/repo.git'
        const expected: GitRemoteRepository = {
          name: 'repo',
          group: 'group/subgroup',
          href: 'https://gitlab.com/group/subgroup/repo',
          https: 'https://gitlab.com/group/subgroup/repo.git',
          ssh: 'git@gitlab.com:group/subgroup/repo.git',
        }

        const result = gitUrlAnalysis(url)

        expect(result).toEqual(expected)
      })

      it('应该对无效 URL 返回 null', () => {
        const result = gitUrlAnalysis('invalid-url')

        expect(result).toBeNull()
      })

      it('应该对空 URL 返回 null', () => {
        const result = gitUrlAnalysis('')

        expect(result).toBeNull()
      })
    })

    describe('getGitUser 获取 Git 用户', () => {
      it('应该从 Git 配置命令返回用户', async () => {
        mockExeca.mockResolvedValue({
          stdout: 'user.name=张三\nuser.email=zhangsan@example.com\n',
          stderr: '',
          exitCode: 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        const result = await getGitUser()

        expect(result).toEqual({
          name: 'zhangsan',
          email: 'zhangsan@example.com',
        })
      })

      it('应该回退到 .gitconfig 文件', async () => {
        mockExeca.mockRejectedValue(new Error('找不到 git'))
        mockReadFile.mockResolvedValue(`
[user]
    name = 李四
    email = lisi@example.com
`)
        mockIni.parse.mockReturnValue({
          user: {
            name: '李四',
            email: 'lisi@example.com',
          },
        })

        const result = await getGitUser()

        expect(result).toEqual({
          name: 'lisi',
          email: 'lisi@example.com',
        })
      })

      it('应该处理缺少邮箱的情况', async () => {
        mockExeca.mockRejectedValue(new Error('找不到 git'))
        mockReadFile.mockResolvedValue(`
[user]
    name = 王五
`)
        mockIni.parse.mockReturnValue({
          user: {
            name: '王五',
          },
        })

        const result = await getGitUser()

        expect(result).toEqual({
          name: '王五',
          email: '',
        })
      })
    })
  })

  describe('下载', () => {
    describe('downloadGitRepository 下载 Git 仓库', () => {
      it('应该成功克隆仓库', async () => {
        const tempDir = '/tmp/test-dir'
        mockTmpdir.mockResolvedValue(tempDir)
        mockRun.mockResolvedValue({
          stdout: '',
          stderr: '',
          exitCode: 0,
        } as ExecaReturnValue)

        const result = await downloadGitRepository(
          'https://github.com/user/repo.git',
        )

        expect(result).toBe(path.join(tempDir, 'package'))
        expect(mockRun).toHaveBeenCalledWith(
          'git',
          [
            'git',
            'clone',
            'https://github.com/user/repo.git',
            '-q',
            '-b',
            'master',
            '--depth',
            '1',
            'package',
          ],
          { cwd: tempDir },
        )
      })

      it('应该使用自定义分支和目标', async () => {
        const customDest = '/custom/dest'
        mockRun.mockResolvedValue({
          stdout: '',
          stderr: '',
          exitCode: 0,
        } as ExecaReturnValue)

        const result = await downloadGitRepository(
          'https://github.com/user/repo.git',
          { branch: 'develop', dest: customDest },
        )

        expect(result).toBe(path.join(customDest, 'package'))
        expect(mockRun).toHaveBeenCalledWith(
          'git',
          [
            'git',
            'clone',
            'https://github.com/user/repo.git',
            '-q',
            '-b',
            'develop',
            '--depth',
            '1',
            'package',
          ],
          { cwd: customDest },
        )
      })

      it('应该在失败时抛出增强错误', async () => {
        const tempDir = '/tmp/test-dir'
        mockTmpdir.mockResolvedValue(tempDir)
        mockRun.mockRejectedValue(new Error('网络错误'))

        await expect(
          downloadGitRepository('https://github.com/user/repo.git'),
        ).rejects.toThrow(
          'Download https://github.com/user/repo.git failed: 网络错误.',
        )
      })
    })
  })

  describe('操作', () => {
    describe('gitCommit Git 提交', () => {
      it('应该使用消息提交', async () => {
        mockRun.mockResolvedValue({
          stdout: '',
          stderr: '',
          exitCode: 0,
        } as ExecaReturnValue)

        await gitCommit('测试提交')

        expect(mockRun).toHaveBeenCalledWith('git', ['add', '-A'], undefined)
        expect(mockRun).toHaveBeenCalledWith(
          'git',
          ['commit', '-m', '测试提交'],
          undefined,
        )
      })

      it('应该忽略无内容提交错误', async () => {
        mockRun
          .mockResolvedValueOnce({
            stdout: '',
            stderr: '',
            exitCode: 0,
          } as ExecaReturnValue) // git add
          .mockRejectedValueOnce(
            new Error('nothing to commit, working tree clean'),
          )

        await expect(gitCommit('测试提交')).resolves.not.toThrow()
      })

      it('应该在其他失败时抛出增强错误', async () => {
        mockRun
          .mockResolvedValueOnce({
            stdout: '',
            stderr: '',
            exitCode: 0,
          } as ExecaReturnValue) // git add
          .mockRejectedValueOnce(new Error('权限被拒绝'))

        await expect(gitCommit('测试提交')).rejects.toThrow(
          'Git commit failed: 权限被拒绝.',
        )
      })
    })

    describe('gitPush Git 推送', () => {
      it('应该推送到现有上游', async () => {
        mockRun
          .mockResolvedValueOnce({
            stdout: 'origin/main',
            stderr: '',
            exitCode: 0,
          } as ExecaReturnValue) // getGitUpstreamBranch
          .mockResolvedValueOnce({
            stdout: '',
            stderr: '',
            exitCode: 0,
          } as ExecaReturnValue) // git push

        await gitPush()

        expect(mockRun).toHaveBeenCalledWith('git', ['push'], undefined)
      })

      it('应该为新分支设置上游', async () => {
        mockRun
          .mockRejectedValueOnce(new Error('no upstream')) // getGitUpstreamBranch
          .mockResolvedValueOnce({
            stdout: 'feature-branch',
            stderr: '',
            exitCode: 0,
          } as ExecaReturnValue) // getGitBranch
          .mockResolvedValueOnce({
            stdout: '',
            stderr: '',
            exitCode: 0,
          } as ExecaReturnValue) // git push

        await gitPush()

        expect(mockRun).toHaveBeenCalledWith(
          'git',
          ['push', '--set-upstream', 'origin', 'feature-branch'],
          undefined,
        )
      })
    })

    describe('gitTag Git 标签', () => {
      it('应该成功创建标签', async () => {
        mockRun.mockResolvedValue({
          stdout: '',
          stderr: '',
          exitCode: 0,
        } as ExecaReturnValue)

        await gitTag('v1.0.0')

        expect(mockRun).toHaveBeenCalledWith(
          'git',
          ['tag', 'v1.0.0', '-m', 'v1.0.0'],
          undefined,
        )
      })

      it('应该在失败时抛出增强错误', async () => {
        mockRun.mockRejectedValue(new Error('标签已存在'))

        await expect(gitTag('v1.0.0')).rejects.toThrow(
          'Git Tag failed: 标签已存在',
        )
      })
    })
  })
})
