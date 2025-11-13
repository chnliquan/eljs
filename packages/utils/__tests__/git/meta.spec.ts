/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-var-requires */
import os from 'node:os'

import {
  getGitBranch,
  getGitCommitSha,
  getGitLatestTag,
  getGitRepository,
  getGitRepositorySync,
  getGitUpstreamBranch,
  getGitUrl,
  getGitUrlSync,
  getGitUser,
  getGitUserSync,
  getProjectGitDir,
  getProjectGitDirSync,
  gitUrlAnalysis,
} from '../../src/git/meta'

// Mock 依赖项
jest.mock('../../src/cp')
jest.mock('../../src/type')
jest.mock('../../src/file')
jest.mock('execa')
jest.mock('ini')
jest.mock('node:os')

describe('Git Meta 工具', () => {
  const mockRun = require('../../src/cp').run as jest.MockedFunction<
    (
      command: string,
      args: string[],
      options?: unknown,
    ) => Promise<{ stdout: string }>
  >
  const mockIsObject = require('../../src/type')
    .isObject as jest.MockedFunction<(value: unknown) => boolean>
  const mockIsPathExists = require('../../src/file')
    .isPathExists as jest.MockedFunction<(path: string) => Promise<boolean>>
  const mockIsPathExistsSync = require('../../src/file')
    .isPathExistsSync as jest.MockedFunction<(path: string) => boolean>
  const mockReadFile = require('../../src/file')
    .readFile as jest.MockedFunction<(path: string) => Promise<string>>
  const mockReadFileSync = require('../../src/file')
    .readFileSync as jest.MockedFunction<(path: string) => string>
  const mockExeca = require('execa') as jest.MockedFunction<
    (command: string, args: string[]) => Promise<{ stdout: string }>
  > & {
    sync: jest.MockedFunction<
      (command: string, args: string[]) => { stdout: string }
    >
  }
  const mockIni = require('ini') as {
    parse: jest.MockedFunction<(content: string) => unknown>
  }
  const mockOs = os as jest.Mocked<typeof os>

  beforeEach(() => {
    jest.clearAllMocks()
    mockIsObject.mockReturnValue(false)
    mockOs.homedir.mockReturnValue('/home/user')
  })

  describe('getGitBranch', () => {
    it('应该获取当前分支名', async () => {
      mockRun.mockResolvedValue({ stdout: '  main  \n' })

      const result = await getGitBranch()

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        undefined,
      )
      expect(result).toBe('main')
    })

    it('应该传递选项', async () => {
      const options = { cwd: '/project' }
      mockRun.mockResolvedValue({ stdout: 'feature-branch' })

      const result = await getGitBranch(options)

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        options,
      )
      expect(result).toBe('feature-branch')
    })

    it('应该正确trim输出', async () => {
      mockRun.mockResolvedValue({ stdout: '\n  develop  \n\n' })

      const result = await getGitBranch()

      expect(result).toBe('develop')
    })
  })

  describe('getGitUpstreamBranch', () => {
    it('应该获取上游分支', async () => {
      mockRun.mockResolvedValue({ stdout: 'origin/main\n' })

      const result = await getGitUpstreamBranch()

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['rev-parse', '--abbrev-ref', '@{u}'],
        undefined,
      )
      expect(result).toBe('origin/main')
    })

    it('应该在没有上游分支时返回null', async () => {
      mockRun.mockRejectedValue(new Error('No upstream configured'))

      const result = await getGitUpstreamBranch()

      expect(result).toBeNull()
    })

    it('应该传递选项', async () => {
      const options = { verbose: false }
      mockRun.mockResolvedValue({ stdout: 'origin/develop' })

      const result = await getGitUpstreamBranch(options)

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['rev-parse', '--abbrev-ref', '@{u}'],
        options,
      )
      expect(result).toBe('origin/develop')
    })

    it('应该处理不同的上游分支格式', async () => {
      const testCases = [
        { output: 'origin/develop', expected: 'origin/develop' },
        { output: 'upstream/main\n', expected: 'upstream/main' },
        { output: '  fork/feature-branch  ', expected: 'fork/feature-branch' },
      ]

      for (const testCase of testCases) {
        mockRun.mockResolvedValue({ stdout: testCase.output })
        const result = await getGitUpstreamBranch()
        expect(result).toBe(testCase.expected)
      }
    })
  })

  describe('getGitCommitSha', () => {
    it('应该获取完整的commit SHA', async () => {
      mockRun.mockResolvedValue({
        stdout: 'a1b2c3d4e5f6789012345678901234567890abcd\n',
      })

      const result = await getGitCommitSha()

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['rev-parse', 'HEAD'],
        undefined,
      )
      expect(result).toBe('a1b2c3d4e5f6789012345678901234567890abcd')
    })

    it('应该获取短commit SHA', async () => {
      mockIsObject.mockReturnValue(false)
      mockRun.mockResolvedValue({ stdout: 'a1b2c3d\n' })

      const result = await getGitCommitSha(true)

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['rev-parse', '--short', 'HEAD'],
        undefined,
      )
      expect(result).toBe('a1b2c3d')
    })

    it('应该处理选项作为第一个参数', async () => {
      const options = { cwd: '/project' }
      mockIsObject.mockReturnValue(true)
      mockRun.mockResolvedValue({ stdout: 'commit-sha' })

      const result = await getGitCommitSha(options)

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['rev-parse', 'HEAD'],
        options,
      )
      expect(result).toBe('commit-sha')
    })

    it('应该同时处理short和options参数', async () => {
      const options = { verbose: true }
      mockIsObject.mockReturnValue(false)
      mockRun.mockResolvedValue({ stdout: 'short-sha' })

      const result = await getGitCommitSha(true, options)

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['rev-parse', '--short', 'HEAD'],
        options,
      )
      expect(result).toBe('short-sha')
    })
  })

  describe('getGitLatestTag', () => {
    it('应该获取最新标签', async () => {
      mockRun.mockResolvedValue({ stdout: 'v1.0.0-1-g123abc\n' })

      const result = await getGitLatestTag()

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['describe', '--tags', '--match', '*'],
        undefined,
      )
      expect(result).toBe('v1.0.0-1-g123abc')
    })

    it('应该使用匹配模式', async () => {
      mockIsObject.mockReturnValue(false)
      mockRun.mockResolvedValue({ stdout: 'v2.0.0' })

      const result = await getGitLatestTag('v*')

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['describe', '--tags', '--match', 'v*'],
        undefined,
      )
      expect(result).toBe('v2.0.0')
    })

    it('应该处理匹配模式和额外参数', async () => {
      mockIsObject
        .mockReturnValueOnce(false) // match不是对象
        .mockReturnValueOnce(false) // args不是对象
      mockRun.mockResolvedValue({ stdout: 'matched-tag' })

      const result = await getGitLatestTag('release-*', ['--abbrev=0'])

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['describe', '--tags', '--match', 'release-*', '--abbrev=0'],
        undefined,
      )
      expect(result).toBe('matched-tag')
    })

    it('应该在命令失败时返回null', async () => {
      mockRun.mockRejectedValue(new Error('No tags found'))

      const result = await getGitLatestTag()

      expect(result).toBeNull()
    })

    it('应该处理args作为第二个参数', async () => {
      mockIsObject
        .mockReturnValueOnce(false) // match不是对象
        .mockReturnValueOnce(true) // args是对象(options)
      mockRun.mockResolvedValue({ stdout: 'tag-with-options' })

      const result = await getGitLatestTag('prefix-*', { cwd: '/test' })

      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['describe', '--tags', '--match', 'prefix-*'],
        { cwd: '/test' },
      )
      expect(result).toBe('tag-with-options')
    })
  })

  describe('gitUrlAnalysis', () => {
    it('应该解析SSH格式的Git URL', () => {
      const sshUrl = 'git@github.com:user/repo.git'

      const result = gitUrlAnalysis(sshUrl)

      expect(result).toEqual({
        name: 'repo',
        group: 'user',
        href: 'https://github.com/user/repo',
        https: 'https://github.com/user/repo.git',
        ssh: 'git@github.com:user/repo.git',
      })
    })

    it('应该解析HTTPS格式的Git URL', () => {
      const httpsUrl = 'https://github.com/organization/project.git'

      const result = gitUrlAnalysis(httpsUrl)

      expect(result).toEqual({
        name: 'project',
        group: 'organization',
        href: 'https://github.com/organization/project',
        https: 'https://github.com/organization/project.git',
        ssh: 'git@github.com:organization/project.git',
      })
    })

    it('应该处理多级组织结构', () => {
      const nestedUrl = 'https://gitlab.com/company/team/subteam/project.git'

      const result = gitUrlAnalysis(nestedUrl)

      expect(result).toEqual({
        name: 'project',
        group: 'company/team/subteam',
        href: 'https://gitlab.com/company/team/subteam/project',
        https: 'https://gitlab.com/company/team/subteam/project.git',
        ssh: 'git@gitlab.com:company/team/subteam/project.git',
      })
    })

    it('应该在空URL时返回null', () => {
      expect(gitUrlAnalysis('')).toBeNull()
      expect(gitUrlAnalysis(null as unknown as string)).toBeNull()
      expect(gitUrlAnalysis(undefined as unknown as string)).toBeNull()
    })

    it('应该在无效URL格式时返回null', () => {
      expect(gitUrlAnalysis('invalid-url')).toBeNull()
      expect(gitUrlAnalysis('ftp://invalid.com/repo')).toBeNull()
      expect(gitUrlAnalysis('just-a-string')).toBeNull()
    })

    it('应该处理URL解析错误', () => {
      const invalidUrls = [
        'https://invalid-domain-@#$%',
        'http://[invalid-ipv6',
        'https://',
      ]

      invalidUrls.forEach(url => {
        expect(gitUrlAnalysis(url)).toBeNull()
      })
    })

    it('应该处理企业Git服务器', () => {
      const corpUrl = 'git@git.corp.company.com:team/awesome-project.git'

      const result = gitUrlAnalysis(corpUrl)

      expect(result).toEqual({
        name: 'awesome-project',
        group: 'team',
        href: 'https://git.corp.company.com/team/awesome-project',
        https: 'https://git.corp.company.com/team/awesome-project.git',
        ssh: 'git@git.corp.company.com:team/awesome-project.git',
      })
    })

    it('应该处理不同Git服务器', () => {
      const testCases = [
        {
          url: 'git@gitlab.com:group/project.git',
          expected: {
            name: 'project',
            group: 'group',
            href: 'https://gitlab.com/group/project',
            https: 'https://gitlab.com/group/project.git',
            ssh: 'git@gitlab.com:group/project.git',
          },
        },
        {
          url: 'https://bitbucket.org/team/repository.git',
          expected: {
            name: 'repository',
            group: 'team',
            href: 'https://bitbucket.org/team/repository',
            https: 'https://bitbucket.org/team/repository.git',
            ssh: 'git@bitbucket.org:team/repository.git',
          },
        },
      ]

      testCases.forEach(testCase => {
        expect(gitUrlAnalysis(testCase.url)).toEqual(testCase.expected)
      })
    })

    it('应该处理特殊字符和复杂路径', () => {
      const complexCases = [
        {
          url: 'git@server.com:org/repo-with-dashes_and_underscores.git',
          name: 'repo-with-dashes_and_underscores',
          group: 'org',
        },
        {
          url: 'https://git.internal:8080/department/team/project-name.git',
          name: 'project-name',
          group: 'department/team',
        },
      ]

      complexCases.forEach(testCase => {
        const result = gitUrlAnalysis(testCase.url)
        expect(result?.name).toBe(testCase.name)
        expect(result?.group).toBe(testCase.group)
      })
    })
  })

  describe('错误处理和边界情况', () => {
    it('应该处理Git命令失败', async () => {
      const errorCases = [
        'fatal: not a git repository',
        "fatal: ambiguous argument 'HEAD'",
        "error: pathspec '@{u}' did not match any file(s) known to git",
      ]

      for (const errorMessage of errorCases) {
        mockRun.mockRejectedValue(new Error(errorMessage))

        await expect(getGitBranch()).rejects.toThrow(errorMessage)
        await expect(getGitCommitSha()).rejects.toThrow(errorMessage)

        // getGitUpstreamBranch 应该返回null而不是抛错
        await expect(getGitUpstreamBranch()).resolves.toBeNull()

        // getGitLatestTag 也应该返回null
        await expect(getGitLatestTag()).resolves.toBeNull()
      }
    })

    it('应该处理空输出', async () => {
      const emptyCases = ['', ' ', '\n', '\t\n\t']

      for (const emptyOutput of emptyCases) {
        mockRun.mockResolvedValue({ stdout: emptyOutput })

        const branchResult = await getGitBranch()
        const shaResult = await getGitCommitSha()
        const tagResult = await getGitLatestTag()

        expect(branchResult).toBe('')
        expect(shaResult).toBe('')
        expect(tagResult).toBe('')
      }
    })

    it('应该处理参数重载逻辑', async () => {
      // 测试getGitCommitSha的参数重载
      mockIsObject.mockReturnValueOnce(true) // 第一个参数是options
      mockRun.mockResolvedValue({ stdout: 'sha-from-options' })

      const result1 = await getGitCommitSha({ cwd: '/test' })
      expect(result1).toBe('sha-from-options')

      // 测试getGitLatestTag的参数重载
      mockIsObject.mockReturnValueOnce(true) // 第一个参数是options
      mockRun.mockResolvedValue({ stdout: 'tag-from-options' })

      const result2 = await getGitLatestTag({ verbose: false })
      expect(result2).toBe('tag-from-options')

      // 验证参数处理
      expect(mockRun).toHaveBeenCalledWith('git', ['rev-parse', 'HEAD'], {
        cwd: '/test',
      })
      expect(mockRun).toHaveBeenCalledWith(
        'git',
        ['describe', '--tags', '--match', '*'],
        { verbose: false },
      )
    })
  })

  describe('类型安全验证', () => {
    it('应该返回正确类型的GitRemoteRepository', () => {
      const testUrl = 'git@github.com:test/repository.git'
      const result = gitUrlAnalysis(testUrl)

      if (result) {
        // TypeScript 应该知道这些属性的类型
        expect(typeof result.name).toBe('string')
        expect(typeof result.group).toBe('string')
        expect(typeof result.href).toBe('string')
        expect(typeof result.https).toBe('string')
        expect(typeof result.ssh).toBe('string')

        expect(result.name).toBe('repository')
        expect(result.group).toBe('test')
      }
    })

    it('应该处理null值安全', () => {
      const nullResult = gitUrlAnalysis('')
      expect(nullResult).toBeNull()

      // TypeScript 类型守卫
      if (nullResult !== null) {
        expect(nullResult.name).toBeDefined()
      }
    })
  })

  describe('实际使用场景', () => {
    it('应该支持版本发布工作流', async () => {
      // 模拟获取发布信息的场景
      mockRun
        .mockResolvedValueOnce({ stdout: 'main' }) // 当前分支
        .mockResolvedValueOnce({ stdout: 'abc123def' }) // commit SHA
        .mockResolvedValueOnce({ stdout: 'v1.0.0' }) // 最新tag

      const branch = await getGitBranch()
      const sha = await getGitCommitSha(true)
      const latestTag = await getGitLatestTag('v*')

      expect(branch).toBe('main')
      expect(sha).toBe('abc123def')
      expect(latestTag).toBe('v1.0.0')
    })

    it('应该支持多仓库信息提取', () => {
      const repositories = [
        'git@github.com:facebook/react.git',
        'https://github.com/microsoft/vscode.git',
        'git@gitlab.com:gitlab-org/gitlab.git',
      ]

      const results = repositories.map(url => gitUrlAnalysis(url))

      expect(results[0]?.name).toBe('react')
      expect(results[0]?.group).toBe('facebook')
      expect(results[1]?.name).toBe('vscode')
      expect(results[1]?.group).toBe('microsoft')
      expect(results[2]?.name).toBe('gitlab')
      expect(results[2]?.group).toBe('gitlab-org')
    })
  })

  describe('getGitUrl 和 getGitUrlSync', () => {
    describe('getGitUrl', () => {
      it('应该从 .git/config 文件获取 URL', async () => {
        mockIsPathExists.mockResolvedValue(true)
        mockReadFile.mockResolvedValue(`
[core]
    repositoryformatversion = 0
[remote "origin"]
    url = https://github.com/user/repo.git
    fetch = +refs/heads/*:refs/remotes/origin/*
`)
        mockIni.parse.mockReturnValue({
          'remote "origin"': {
            url: 'https://github.com/user/repo.git',
          },
        })

        const result = await getGitUrl('/project')

        expect(result).toBe('https://github.com/user/repo.git')
        expect(mockReadFile).toHaveBeenCalledWith('/project/.git/config')
      })

      it('应该在使用 exact=true 时检查当前目录', async () => {
        mockIsPathExists.mockResolvedValue(true)
        mockReadFile.mockResolvedValue('')
        mockIni.parse.mockReturnValue({
          'remote "origin"': { url: 'git@github.com:user/exact-repo.git' },
        })

        const result = await getGitUrl('/exact-dir', true)

        expect(mockIsPathExists).toHaveBeenCalledWith('/exact-dir/.git')
        expect(result).toBe('git@github.com:user/exact-repo.git')
      })

      it('应该在 .git 目录不存在时返回空字符串', async () => {
        mockIsPathExists.mockResolvedValue(false)

        const result = await getGitUrl('/no-git')

        expect(result).toBe('')
        expect(mockReadFile).not.toHaveBeenCalled()
      })

      it('应该在读取配置文件失败时返回空字符串', async () => {
        mockIsPathExists.mockResolvedValue(true)
        mockReadFile.mockRejectedValue(new Error('Read failed'))

        const result = await getGitUrl('/error-project')

        expect(result).toBe('')
      })

      it('应该在没有 origin 远程时返回空字符串', async () => {
        mockIsPathExists.mockResolvedValue(true)
        mockReadFile.mockResolvedValue('[core]\n    bare = false\n')
        mockIni.parse.mockReturnValue({ core: { bare: false } })

        const result = await getGitUrl('/no-origin')

        expect(result).toBe('')
      })
    })

    describe('getGitUrlSync', () => {
      it('应该同步获取 Git URL', () => {
        mockIsPathExistsSync.mockReturnValue(true)
        mockReadFileSync.mockReturnValue(`
[remote "origin"]
    url = git@gitlab.com:company/project.git
`)
        mockIni.parse.mockReturnValue({
          'remote "origin"': { url: 'git@gitlab.com:company/project.git' },
        })

        const result = getGitUrlSync('/sync-project')

        expect(result).toBe('git@gitlab.com:company/project.git')
        expect(mockReadFileSync).toHaveBeenCalledWith(
          '/sync-project/.git/config',
        )
      })

      it('应该在同步模式下处理错误', () => {
        mockIsPathExistsSync.mockReturnValue(true)
        mockReadFileSync.mockImplementation(() => {
          throw new Error('Sync read failed')
        })

        const result = getGitUrlSync('/sync-error')

        expect(result).toBe('')
      })
    })
  })

  describe('getGitRepository 和 getGitRepositorySync', () => {
    const mockGitConfig = `
[core]
    repositoryformatversion = 0
[user]
    name = Test User
    email = test@example.com
[remote "origin"]
    url = git@github.com:test/repository.git
    fetch = +refs/heads/*:refs/remotes/origin/*
`

    const mockGitHead = 'ref: refs/heads/main\n'

    describe('getGitRepository', () => {
      it('应该获取完整的 Git 仓库信息', async () => {
        mockIsPathExists.mockResolvedValue(true)
        mockReadFile
          .mockResolvedValueOnce(mockGitConfig) // config
          .mockResolvedValueOnce(mockGitHead) // HEAD

        mockIni.parse.mockReturnValue({
          user: { name: 'Test User', email: 'test@example.com' },
          'remote "origin"': { url: 'git@github.com:test/repository.git' },
        })

        const result = await getGitRepository('/project')

        expect(result).toEqual({
          name: 'repository',
          group: 'test',
          href: 'https://github.com/test/repository',
          https: 'https://github.com/test/repository.git',
          ssh: 'git@github.com:test/repository.git',
          branch: 'main',
          author: 'Test User',
          email: 'test@example.com',
        })
      })

      it('应该处理没有用户信息的情况', async () => {
        mockIsPathExists.mockResolvedValue(true)
        mockReadFile
          .mockResolvedValueOnce(
            '[remote "origin"]\n    url = git@github.com:test/repo.git',
          )
          .mockResolvedValueOnce(mockGitHead)

        mockIni.parse.mockReturnValue({
          'remote "origin"': { url: 'git@github.com:test/repo.git' },
        })

        const result = await getGitRepository('/no-user')

        expect(result?.author).toBe('')
        expect(result?.email).toBe('')
        expect(result?.name).toBe('repo')
      })

      it('应该处理没有 origin 远程的情况', async () => {
        mockIsPathExists.mockResolvedValue(true)
        mockReadFile
          .mockResolvedValueOnce('[core]\n    bare = false')
          .mockResolvedValueOnce(mockGitHead)

        mockIni.parse.mockReturnValue({ core: { bare: false } })

        const result = await getGitRepository('/no-origin')

        expect(result?.ssh).toBe('')
        expect(result?.name).toBe('')
      })

      it('应该在 Git 目录不存在时返回 null', async () => {
        mockIsPathExists.mockResolvedValue(false)

        const result = await getGitRepository('/no-git')

        expect(result).toBeNull()
      })

      it('应该在读取配置失败时返回 null', async () => {
        mockIsPathExists.mockResolvedValue(true)
        mockReadFile.mockRejectedValue(new Error('Config read failed'))

        const result = await getGitRepository('/error')

        expect(result).toBeNull()
      })

      it('应该处理复杂的分支引用', async () => {
        const complexHead = 'ref: refs/heads/feature/complex-branch-name\n'
        mockIsPathExists.mockResolvedValue(true)
        mockReadFile
          .mockResolvedValueOnce(mockGitConfig)
          .mockResolvedValueOnce(complexHead)

        mockIni.parse.mockReturnValue({
          'remote "origin"': { url: 'git@github.com:test/repo.git' },
        })

        const result = await getGitRepository('/complex')

        expect(result?.branch).toBe('feature/complex-branch-name')
      })
    })

    describe('getGitRepositorySync', () => {
      it('应该同步获取 Git 仓库信息', () => {
        mockIsPathExistsSync.mockReturnValue(true)
        mockReadFileSync
          .mockReturnValueOnce(mockGitConfig)
          .mockReturnValueOnce(mockGitHead)

        mockIni.parse.mockReturnValue({
          user: { name: 'Sync User', email: 'sync@example.com' },
          'remote "origin"': { url: 'https://github.com/sync/project.git' },
        })

        const result = getGitRepositorySync('/sync-project')

        expect(result?.author).toBe('Sync User')
        expect(result?.email).toBe('sync@example.com')
        expect(result?.name).toBe('project')
      })

      it('应该在同步模式下处理错误', () => {
        mockIsPathExistsSync.mockReturnValue(true)
        mockReadFileSync.mockImplementation(() => {
          throw new Error('Sync config read failed')
        })

        const result = getGitRepositorySync('/sync-error')

        expect(result).toBeNull()
      })
    })
  })

  describe('getGitUser 和 getGitUserSync', () => {
    describe('getGitUser', () => {
      it('应该从 git config 获取用户信息', async () => {
        mockExeca.mockResolvedValue({
          stdout:
            'user.name=John Doe\nuser.email=john@company.com\ncore.editor=vim',
        })

        const result = await getGitUser()

        expect(result).toEqual({
          name: 'john',
          email: 'john@company.com',
        })
        expect(mockExeca).toHaveBeenCalledWith('git', ['config', '--list'])
      })

      it('应该处理只有 user.name 的情况', async () => {
        mockExeca.mockResolvedValue({
          stdout: 'user.name=Jane Smith\ncore.autocrlf=false',
        })

        const result = await getGitUser()

        expect(result).toEqual({
          name: 'Jane Smith',
          email: '',
        })
      })

      it('应该在 git 命令失败时回退到 .gitconfig 文件', async () => {
        mockExeca.mockRejectedValue(new Error('git not found'))
        mockReadFile.mockResolvedValue(`
[user]
    name = Config User
    email = config@example.com
[core]
    editor = nano
`)
        mockIni.parse.mockReturnValue({
          user: { name: 'Config User', email: 'config@example.com' },
        })

        const result = await getGitUser()

        expect(result).toEqual({
          name: 'config',
          email: 'config@example.com',
        })
        expect(mockReadFile).toHaveBeenCalledWith('/home/user/.gitconfig')
      })

      it('应该处理 .gitconfig 中没有邮箱的情况', async () => {
        mockExeca.mockRejectedValue(new Error('git not found'))
        mockReadFile.mockResolvedValue(`
[user]
    name = No Email User
`)
        mockIni.parse.mockReturnValue({
          user: { name: 'No Email User' },
        })

        const result = await getGitUser()

        expect(result).toEqual({
          name: 'No Email User',
          email: '',
        })
      })

      it('应该在所有方法都失败时返回空用户信息', async () => {
        mockExeca.mockRejectedValue(new Error('git not found'))
        mockReadFile.mockRejectedValue(new Error('No .gitconfig file'))

        const result = await getGitUser()

        expect(result).toEqual({
          name: '',
          email: '',
        })
      })

      it('应该处理 git config 输出的边界情况', async () => {
        mockExeca.mockResolvedValue({
          stdout: 'user.email=boundary@test.com\n\nuser.name=Boundary User\n\n',
        })

        const result = await getGitUser()

        expect(result).toEqual({
          name: 'boundary',
          email: 'boundary@test.com',
        })
      })

      it('应该检查邮箱是否以 .com 结尾并回退到 .gitconfig', async () => {
        // 首次调用返回非 .com 邮箱
        mockExeca.mockResolvedValue({
          stdout: 'user.email=user@internal\nuser.name=Internal User',
        })
        mockReadFile.mockResolvedValue(`
[user]
    email = fallback@company.com
    name = Fallback User
`)
        mockIni.parse.mockReturnValue({
          user: { email: 'fallback@company.com', name: 'Fallback User' },
        })

        const result = await getGitUser()

        expect(result).toEqual({
          name: 'fallback',
          email: 'fallback@company.com',
        })
      })
    })

    describe('getGitUserSync', () => {
      it('应该同步获取 git 用户信息', () => {
        mockExeca.sync.mockReturnValue({
          stdout: 'user.name=Sync User\nuser.email=sync@example.com',
        })

        const result = getGitUserSync()

        expect(result).toEqual({
          name: 'sync',
          email: 'sync@example.com',
        })
        expect(mockExeca.sync).toHaveBeenCalledWith('git', ['config', '--list'])
      })

      it('应该在同步模式下回退到 .gitconfig', () => {
        mockExeca.sync.mockImplementation(() => {
          throw new Error('git command failed')
        })
        mockReadFileSync.mockReturnValue(`
[user]
    name = Sync Config User
    email = syncconfig@test.com
`)
        mockIni.parse.mockReturnValue({
          user: { name: 'Sync Config User', email: 'syncconfig@test.com' },
        })

        const result = getGitUserSync()

        expect(result).toEqual({
          name: 'syncconfig',
          email: 'syncconfig@test.com',
        })
      })

      it('应该在同步模式下处理所有错误', () => {
        mockExeca.sync.mockImplementation(() => {
          throw new Error('git failed')
        })
        mockReadFileSync.mockImplementation(() => {
          throw new Error('file not found')
        })

        const result = getGitUserSync()

        expect(result).toEqual({
          name: '',
          email: '',
        })
      })
    })
  })

  describe('getProjectGitDir 和 getProjectGitDirSync', () => {
    describe('getProjectGitDir', () => {
      it('应该找到当前目录的 .git 目录', async () => {
        mockIsPathExists.mockResolvedValue(true)

        const result = await getProjectGitDir('/project')

        expect(result).toBe('/project/.git')
        expect(mockIsPathExists).toHaveBeenCalledWith('/project/.git/config')
      })

      it('应该向上查找 .git 目录', async () => {
        mockIsPathExists
          .mockResolvedValueOnce(false) // /project/subdir/.git/config
          .mockResolvedValueOnce(false) // /project/.git/config
          .mockResolvedValueOnce(true) // //.git/config

        const result = await getProjectGitDir('/project/subdir')

        expect(result).toBe('/.git')
        expect(mockIsPathExists).toHaveBeenCalledTimes(3)
      })

      it('应该在找不到 .git 目录时返回 undefined', async () => {
        mockIsPathExists.mockResolvedValue(false)

        const result = await getProjectGitDir('/no-git')

        expect(result).toBeUndefined()
      })

      it('应该在到达根目录时停止查找', async () => {
        mockIsPathExists.mockResolvedValue(false)

        const result = await getProjectGitDir('/')

        expect(result).toBeUndefined()
        expect(mockIsPathExists).toHaveBeenCalledWith('/.git/config')
      })

      it('应该处理复杂的路径层次结构', async () => {
        mockIsPathExists
          .mockResolvedValueOnce(false) // /a/b/c/d/.git/config
          .mockResolvedValueOnce(false) // /a/b/c/.git/config
          .mockResolvedValueOnce(true) // /a/b/.git/config

        const result = await getProjectGitDir('/a/b/c/d')

        expect(result).toBe('/a/b/.git')
      })
    })

    describe('getProjectGitDirSync', () => {
      it('应该同步找到 .git 目录', () => {
        mockIsPathExistsSync.mockReturnValue(true)

        const result = getProjectGitDirSync('/sync-project')

        expect(result).toBe('/sync-project/.git')
        expect(mockIsPathExistsSync).toHaveBeenCalledWith(
          '/sync-project/.git/config',
        )
      })

      it('应该同步向上查找', () => {
        mockIsPathExistsSync
          .mockReturnValueOnce(false) // current dir
          .mockReturnValueOnce(true) // parent dir

        const result = getProjectGitDirSync('/sync/deep')

        expect(result).toBe('/sync/.git')
      })

      it('应该在同步模式下找不到时返回 undefined', () => {
        mockIsPathExistsSync.mockReturnValue(false)

        const result = getProjectGitDirSync('/no-sync-git')

        expect(result).toBeUndefined()
      })
    })
  })
})
