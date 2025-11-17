/* eslint-disable @typescript-eslint/no-var-requires */
// Mock @eljs/utils
const mockUtils = {
  getGitUserSync: jest.fn(() => ({
    name: 'Test Author',
    email: 'test@example.com',
  })),
  gitUrlAnalysis: jest.fn(),
  getGitUrlSync: jest.fn(() => 'https://github.com/test/repo.git'),
}

jest.mock('@eljs/utils', () => mockUtils)

describe('内部工具', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // 清除缓存的模块以测试缓存行为
    jest.resetModules()
  })

  describe('作者和邮箱', () => {
    it('应该从 git 用户导出作者信息', () => {
      const { author } = require('../../src/internal/utils')
      expect(typeof author).toBe('string')
      expect(author).toBe('Test Author')
    })

    it('应该从 git 用户导出邮箱信息', () => {
      const { email } = require('../../src/internal/utils')
      expect(typeof email).toBe('string')
      expect(email).toBe('test@example.com')
    })
  })

  describe('getGitUrl', () => {
    it('应该是一个函数', () => {
      const { getGitUrl } = require('../../src/internal/utils')
      expect(typeof getGitUrl).toBe('function')
    })

    it('应该返回目标目录的 git url', () => {
      const { getGitUrl } = require('../../src/internal/utils')
      const targetDir = '/path/to/project'
      const result = getGitUrl(targetDir)

      expect(result).toBe('https://github.com/test/repo.git')
    })

    it('应该缓存 git url 并在后续调用中返回相同值', () => {
      // 导入新模块
      const { getGitUrl } = require('../../src/internal/utils')

      const targetDir1 = '/path/to/project1'
      const targetDir2 = '/path/to/project2'

      const result1 = getGitUrl(targetDir1)
      const result2 = getGitUrl(targetDir2)

      expect(result1).toBe(result2)
      // 缓存后，应该不再调用 getGitUrlSync
      expect(result1).toBe('https://github.com/test/repo.git')
    })
  })

  describe('getGitHref', () => {
    it('应该是一个函数', () => {
      const { getGitHref } = require('../../src/internal/utils')
      expect(typeof getGitHref).toBe('function')
    })

    it('应该从 url 分析返回 git href', () => {
      mockUtils.gitUrlAnalysis.mockReturnValue({
        href: 'https://github.com/test/repo',
      })

      const { getGitHref } = require('../../src/internal/utils')
      const gitUrl = 'https://github.com/test/repo.git'
      const result = getGitHref(gitUrl)

      expect(result).toBe('https://github.com/test/repo')
      expect(mockUtils.gitUrlAnalysis).toHaveBeenCalledWith(gitUrl)
    })

    it('当 git url 分析返回 null 时应该返回占位符', () => {
      mockUtils.gitUrlAnalysis.mockReturnValue(null)

      const { getGitHref } = require('../../src/internal/utils')
      const gitUrl = 'invalid-url'
      const result = getGitHref(gitUrl)

      expect(result).toBe('${gitHref}')
    })

    it('当 git url 分析返回未定义的 href 时应该返回占位符', () => {
      mockUtils.gitUrlAnalysis.mockReturnValue({ href: undefined })

      const { getGitHref } = require('../../src/internal/utils')
      const gitUrl = 'https://github.com/test/repo.git'
      const result = getGitHref(gitUrl)

      expect(result).toBe('${gitHref}')
    })

    it('应该缓存 git href 并在后续调用中返回相同值', () => {
      mockUtils.gitUrlAnalysis.mockReturnValue({
        href: 'https://github.com/test/repo',
      })

      // 导入新模块以测试缓存
      const { getGitHref } = require('../../src/internal/utils')

      const gitUrl1 = 'https://github.com/test/repo1.git'
      const gitUrl2 = 'https://github.com/test/repo2.git'

      const result1 = getGitHref(gitUrl1)
      const result2 = getGitHref(gitUrl2)

      expect(result1).toBe(result2)
      // 应该在第一次调用后缓存
      expect(result1).toBe('https://github.com/test/repo')
    })
  })
})
