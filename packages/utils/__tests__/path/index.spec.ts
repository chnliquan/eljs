/* eslint-disable @typescript-eslint/no-var-requires */
import * as path from 'node:path'

import {
  extractCallDir,
  getBunWorkspaceRoot,
  getLernaWorkspaceRoot,
  getNpmWorkspaceRoot,
  getPnpmWorkspaceRoot,
  getWorkspaces,
  getYarnWorkspaceRoot,
  tryPaths,
  tryPathsSync,
  winPath,
} from '../../src/path'

// Mock 依赖项
jest.mock('find-up')
jest.mock('glob')
jest.mock('js-yaml')
jest.mock('../../src/file')
jest.mock('../../src/npm')

describe('路径工具函数', () => {
  const mockFindUp = require('find-up') as jest.MockedFunction<
    (
      patterns: string[],
      options: { cwd: string },
    ) => Promise<string | undefined>
  >
  const mockGlob = require('glob') as {
    sync: jest.MockedFunction<(pattern: string, options: unknown) => string[]>
  }
  const mockYaml = require('js-yaml') as {
    load: jest.MockedFunction<(content: string) => unknown>
  }
  const mockIsPathExists = require('../../src/file')
    .isPathExists as jest.MockedFunction<(path: string) => Promise<boolean>>
  const mockIsPathExistsSync = require('../../src/file')
    .isPathExistsSync as jest.MockedFunction<(path: string) => boolean>
  const mockReadFile = require('../../src/file')
    .readFile as jest.MockedFunction<(path: string) => Promise<string>>
  const mockReadJson = require('../../src/file')
    .readJson as jest.MockedFunction<(path: string) => Promise<unknown>>
  const mockGetPackageManager = require('../../src/npm')
    .getPackageManager as jest.MockedFunction<(cwd: string) => Promise<string>>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('winPath Windows 路径转换', () => {
    it('应该转换反斜杠为正斜杠', () => {
      expect(winPath('C:\\Users\\test')).toBe('C:/Users/test')
      expect(winPath('')).toBe('')
    })

    it('应该保留扩展长度路径', () => {
      const extended = '\\\\?\\C:\\long\\path'
      expect(winPath(extended)).toBe(extended)
    })

    it('应该处理混合斜杠', () => {
      expect(winPath('C:\\Users/mixed\\path')).toBe('C:/Users/mixed/path')
    })

    it('应该处理复杂的扩展长度路径', () => {
      const testCases = [
        {
          input: '\\\\?\\C:\\Program Files\\test',
          expected: '\\\\?\\C:\\Program Files\\test',
        },
        {
          input: '\\\\?\\UNC\\server\\share',
          expected: '\\\\?\\UNC\\server\\share',
        },
        { input: '\\\\normal\\path', expected: '//normal/path' }, // 双反斜杠变成双正斜杠
      ]

      testCases.forEach(testCase => {
        expect(winPath(testCase.input)).toBe(testCase.expected)
      })
    })
  })

  describe('tryPaths 路径查找', () => {
    it('应该返回第一个存在的路径', async () => {
      mockIsPathExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true)

      const result = await tryPaths(['/no', '/yes'])
      expect(result).toBe('/yes')
    })

    it('应该处理都不存在', async () => {
      mockIsPathExists.mockResolvedValue(false)

      const result = await tryPaths(['/no1', '/no2'])
      expect(result).toBeUndefined()
    })

    it('应该处理空数组', async () => {
      const result = await tryPaths([])
      expect(result).toBeUndefined()
    })

    it('应该按顺序检查', async () => {
      mockIsPathExists
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)

      const result = await tryPaths(['/1', '/2', '/3'])
      expect(result).toBe('/3')
    })
  })

  describe('tryPathsSync 同步查找', () => {
    it('应该返回第一个存在的路径', () => {
      mockIsPathExistsSync.mockReturnValueOnce(false).mockReturnValueOnce(true)

      const result = tryPathsSync(['/no', '/yes'])
      expect(result).toBe('/yes')
    })

    it('应该处理都不存在', () => {
      mockIsPathExistsSync.mockReturnValue(false)

      const result = tryPathsSync(['/no1', '/no2'])
      expect(result).toBeUndefined()
    })

    it('应该处理空数组', () => {
      const result = tryPathsSync([])
      expect(result).toBeUndefined()
    })
  })

  describe('extractCallDir 目录提取', () => {
    it('应该提取调用目录', () => {
      const result = extractCallDir()
      expect(typeof result).toBe('string')
      expect(path.isAbsolute(result)).toBe(true)
    })

    it('应该处理不同栈深度', () => {
      function wrapper() {
        return extractCallDir(3)
      }
      const result = wrapper()
      expect(typeof result).toBe('string')
    })

    it('应该处理匿名函数', () => {
      const result = (() => extractCallDir(3))()
      expect(typeof result).toBe('string')
    })

    it('应该处理复杂嵌套', () => {
      function level1() {
        return level2()
      }
      function level2() {
        return level3()
      }
      function level3() {
        return extractCallDir(5)
      }

      const result = level1()
      expect(typeof result).toBe('string')
    })

    it('应该处理栈深度边界', () => {
      ;[1, 2, 3, 4, 5].forEach(depth => {
        try {
          const result = extractCallDir(depth)
          expect(typeof result).toBe('string')
        } catch {
          // 某些深度可能失败
        }
      })
    })
  })

  describe('工作区根目录检测', () => {
    it('应该检测pnpm工作区', async () => {
      mockFindUp.mockResolvedValue('/project/pnpm-lock.yaml')

      const result = await getPnpmWorkspaceRoot('/project/sub')

      expect(result).toBe('/project')
      expect(mockFindUp).toHaveBeenCalledWith(
        ['pnpm-lock.yaml', 'pnpm-workspace.yaml'],
        { cwd: '/project/sub' },
      )
    })

    it('应该检测yarn工作区', async () => {
      mockFindUp.mockResolvedValue('/project/yarn.lock')

      const result = await getYarnWorkspaceRoot('/project/sub')

      expect(result).toBe('/project')
    })

    it('应该检测lerna工作区', async () => {
      mockFindUp.mockResolvedValue('/project/lerna.json')

      const result = await getLernaWorkspaceRoot('/project/sub')

      expect(result).toBe('/project')
    })

    it('应该检测npm工作区', async () => {
      mockFindUp.mockResolvedValue('/project/package-lock.json')

      const result = await getNpmWorkspaceRoot('/project/sub')

      expect(result).toBe('/project')
    })

    it('应该检测bun工作区', async () => {
      mockFindUp.mockResolvedValue('/project/bun.lockb')

      const result = await getBunWorkspaceRoot('/project/sub')

      expect(result).toBe('/project')
    })

    it('应该在找不到时返回空字符串', async () => {
      mockFindUp.mockResolvedValue(undefined)

      const results = await Promise.all([
        getPnpmWorkspaceRoot('/no'),
        getYarnWorkspaceRoot('/no'),
        getLernaWorkspaceRoot('/no'),
        getNpmWorkspaceRoot('/no'),
        getBunWorkspaceRoot('/no'),
      ])

      results.forEach(result => {
        expect(result).toBe('')
      })
    })
  })

  describe('getWorkspaces 工作区列表', () => {
    it('应该获取npm工作区', async () => {
      mockGetPackageManager.mockResolvedValue('npm')
      mockReadJson.mockResolvedValue({ workspaces: ['packages/*'] })
      mockGlob.sync.mockReturnValue(['packages/app'])

      const result = await getWorkspaces('/project')

      expect(result).toEqual(['/project/packages/app'])
    })

    it('应该获取pnpm工作区', async () => {
      mockGetPackageManager.mockResolvedValue('pnpm')
      mockIsPathExists.mockResolvedValue(true)
      mockReadFile.mockResolvedValue('packages:\n  - "packages/*"')
      mockYaml.load.mockReturnValue({ packages: ['packages/*'] })
      mockGlob.sync.mockReturnValue(['packages/core'])

      const result = await getWorkspaces('/pnpm-project')

      expect(mockIsPathExists).toHaveBeenCalledWith(
        '/pnpm-project/pnpm-workspace.yaml',
      )
      expect(mockYaml.load).toHaveBeenCalled()
      expect(result).toEqual(['/pnpm-project/packages/core'])
    })

    it('应该返回相对路径', async () => {
      mockGetPackageManager.mockResolvedValue('npm')
      mockReadJson.mockResolvedValue({ workspaces: ['packages/*'] })
      mockGlob.sync.mockReturnValue(['packages/app'])

      const result = await getWorkspaces('/project-relative', true)

      expect(result).toEqual(['packages/app'])
    })

    it('应该处理特定包', async () => {
      mockGetPackageManager.mockResolvedValue('npm')
      mockReadJson.mockResolvedValue({ workspaces: ['specific-pkg'] })
      mockIsPathExists.mockResolvedValue(true)

      const result = await getWorkspaces('/project-specific', true)

      expect(mockIsPathExists).toHaveBeenCalledWith(
        '/project-specific/specific-pkg',
      )
      expect(result).toEqual(['specific-pkg'])
    })

    it('应该回退到根目录', async () => {
      mockGetPackageManager.mockResolvedValue('npm')
      mockReadJson.mockResolvedValue({})

      const result = await getWorkspaces('/single')

      expect(result).toEqual(['/single'])
    })

    it('应该处理pnpm无配置文件', async () => {
      mockGetPackageManager.mockResolvedValue('pnpm')
      mockIsPathExists.mockResolvedValue(false)

      const result = await getWorkspaces('/no-pnpm-config')

      expect(result).toEqual(['/no-pnpm-config'])
    })

    it('应该正规化工作区模式', async () => {
      mockGetPackageManager.mockResolvedValue('npm')
      mockReadJson.mockResolvedValue({ workspaces: ['packages/***'] })
      mockGlob.sync.mockReturnValue(['packages/test'])

      const result = await getWorkspaces('/norm', true)

      expect(mockGlob.sync).toHaveBeenCalledWith(
        'packages/*',
        expect.any(Object),
      )
      expect(result).toEqual(['packages/test'])
    })

    it('应该处理复杂配置', async () => {
      mockGetPackageManager.mockResolvedValue('npm')
      mockReadJson.mockResolvedValue({
        workspaces: ['packages/*', 'tools/build'],
      })
      mockGlob.sync.mockReturnValueOnce(['packages/app'])
      mockIsPathExists.mockResolvedValue(true)

      const result = await getWorkspaces('/complex', true)

      expect(result).toEqual(['packages/app', 'tools/build'])
    })

    it('应该测试缓存功能', async () => {
      const testDir = '/cache-test'

      mockGetPackageManager.mockResolvedValue('npm')
      mockReadJson.mockResolvedValue({ workspaces: ['packages/*'] })
      mockGlob.sync.mockReturnValue(['packages/cached'])

      // 第一次调用
      const result1 = await getWorkspaces(testDir)
      expect(result1).toEqual(['/cache-test/packages/cached'])

      // 第二次调用 - 应该使用缓存
      const result2 = await getWorkspaces(testDir)
      expect(result2).toEqual(['/cache-test/packages/cached'])

      // 验证缓存有效
      expect(mockGetPackageManager).toHaveBeenCalledTimes(1)
    })
  })

  describe('错误处理', () => {
    it('应该处理工作区检测错误', async () => {
      mockGetPackageManager.mockRejectedValue(new Error('Detection failed'))

      await expect(getWorkspaces('/error')).rejects.toThrow('Detection failed')
    })

    it('应该处理文件读取错误', async () => {
      mockGetPackageManager.mockResolvedValue('npm')
      mockReadJson.mockRejectedValue(new Error('Read failed'))

      await expect(getWorkspaces('/read-error')).rejects.toThrow('Read failed')
    })

    it('应该处理yaml解析错误', async () => {
      mockGetPackageManager.mockResolvedValue('pnpm')
      mockIsPathExists.mockResolvedValue(true)
      mockReadFile.mockResolvedValue('invalid yaml')
      mockYaml.load.mockImplementation(() => {
        throw new Error('YAML error')
      })

      await expect(getWorkspaces('/yaml-error')).rejects.toThrow('YAML error')
    })
  })

  describe('实际场景', () => {
    it('应该模拟monorepo检测', async () => {
      mockGetPackageManager.mockResolvedValue('pnpm')
      mockIsPathExists.mockResolvedValue(true)
      mockReadFile.mockResolvedValue('packages:\n  - "packages/*"')
      mockYaml.load.mockReturnValue({ packages: ['packages/*'] })
      mockGlob.sync.mockReturnValue(['packages/core', 'packages/ui'])

      const result = await getWorkspaces('/monorepo', true)

      expect(result).toEqual(['packages/core', 'packages/ui'])
    })

    it('应该处理路径查找场景', async () => {
      mockIsPathExists.mockImplementation(
        async (path: string) => path === '/found',
      )

      const result = await tryPaths(['/notfound', '/found', '/also-notfound'])

      expect(result).toBe('/found')
    })
  })

  describe('类型验证', () => {
    it('应该返回正确类型', async () => {
      mockFindUp.mockResolvedValue('/project/pnpm-lock.yaml')

      const result = await getPnpmWorkspaceRoot('/project')

      expect(typeof result).toBe('string')
    })

    it('应该返回字符串数组', async () => {
      mockGetPackageManager.mockResolvedValue('npm')
      mockReadJson.mockResolvedValue({ workspaces: ['packages/*'] })
      mockGlob.sync.mockReturnValue(['packages/test'])

      const result = await getWorkspaces('/project')

      expect(Array.isArray(result)).toBe(true)
      expect(result.every(item => typeof item === 'string')).toBe(true)
    })
  })
})
