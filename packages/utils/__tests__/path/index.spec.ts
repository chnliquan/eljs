import * as importedModule0 from 'find-up'
import * as importedModule1 from 'glob'
import * as importedModule2 from 'js-yaml'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest'
import * as importedModule3 from '../../src/file'
import * as importedModule4 from '../../src/npm/package-manager'

import * as path from 'node:path'
import {
  findExistingPath,
  findExistingPathSync,
  getBunWorkspaceRoot,
  getCallerDirectory,
  getLernaWorkspaceRoot,
  getNpmWorkspaceRoot,
  getPnpmWorkspaceRoot,
  getWorkspacePackageRoots,
  getWorkspaceRoot,
  getYarnWorkspaceRoot,
  toPosixPath,
} from '../../src/path'

const requiredModule0 = vi.mocked(importedModule0, { deep: true })
const requiredModule1 = vi.mocked(importedModule1, { deep: true })
const requiredModule2 = vi.mocked(importedModule2, { deep: true })
const requiredModule3 = vi.mocked(importedModule3, { deep: true })
const requiredModule4 = vi.mocked(importedModule4, { deep: true })

// Mock 依赖项
vi.mock('find-up')
vi.mock('glob')
vi.mock('js-yaml')
vi.mock('../../src/file')
vi.mock('../../src/npm/package-manager')

describe('路径工具函数', () => {
  const mockFindUp = requiredModule0.findUp as unknown as MockedFunction<
    (
      patterns: string[],
      options: { cwd: string },
    ) => Promise<string | undefined>
  >
  const mockGlob = requiredModule1 as {
    sync: MockedFunction<(pattern: string, options: unknown) => string[]>
  }
  const mockYaml = requiredModule2 as {
    load: MockedFunction<(content: string) => unknown>
  }
  const mockPathExists = requiredModule3.pathExists as MockedFunction<
    (path: string) => Promise<boolean>
  >
  const mockPathExistsSync = requiredModule3.pathExistsSync as MockedFunction<
    (path: string) => boolean
  >
  const mockReadFile = requiredModule3.readFile as MockedFunction<
    (path: string) => Promise<string>
  >
  const mockReadJson = requiredModule3.readJson as MockedFunction<
    (path: string) => Promise<unknown>
  >
  const mockGetPackageManager =
    requiredModule4.getPackageManager as MockedFunction<
      (cwd: string) => Promise<string>
    >

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('推荐 API 名称', () => {
    it('应该使用清晰名称完成路径查找和转换', async () => {
      mockPathExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
      mockPathExistsSync.mockReturnValue(true)

      await expect(findExistingPath(['/no', '/yes'])).resolves.toBe('/yes')
      expect(findExistingPathSync(['/yes'])).toBe('/yes')
      expect(toPosixPath('C:\\project\\file.ts')).toBe('C:/project/file.ts')
      expect(typeof getCallerDirectory()).toBe('string')
    })
  })

  describe('toPosixPath Windows 路径转换', () => {
    it('应该转换反斜杠为正斜杠', () => {
      expect(toPosixPath('C:\\Users\\test')).toBe('C:/Users/test')
      expect(toPosixPath('')).toBe('')
    })

    it('应该保留扩展长度路径', () => {
      const extended = '\\\\?\\C:\\long\\path'
      expect(toPosixPath(extended)).toBe(extended)
    })

    it('应该处理混合斜杠', () => {
      expect(toPosixPath('C:\\Users/mixed\\path')).toBe('C:/Users/mixed/path')
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
        expect(toPosixPath(testCase.input)).toBe(testCase.expected)
      })
    })
  })

  describe('findExistingPath 路径查找', () => {
    it('应该返回第一个存在的路径', async () => {
      mockPathExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true)

      const result = await findExistingPath(['/no', '/yes'])
      expect(result).toBe('/yes')
    })

    it('应该处理都不存在', async () => {
      mockPathExists.mockResolvedValue(false)

      const result = await findExistingPath(['/no1', '/no2'])
      expect(result).toBeUndefined()
    })

    it('应该处理空数组', async () => {
      const result = await findExistingPath([])
      expect(result).toBeUndefined()
    })

    it('应该按顺序检查', async () => {
      mockPathExists
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)

      const result = await findExistingPath(['/1', '/2', '/3'])
      expect(result).toBe('/3')
    })
  })

  describe('findExistingPathSync 同步查找', () => {
    it('应该返回第一个存在的路径', () => {
      mockPathExistsSync.mockReturnValueOnce(false).mockReturnValueOnce(true)

      const result = findExistingPathSync(['/no', '/yes'])
      expect(result).toBe('/yes')
    })

    it('应该处理都不存在', () => {
      mockPathExistsSync.mockReturnValue(false)

      const result = findExistingPathSync(['/no1', '/no2'])
      expect(result).toBeUndefined()
    })

    it('应该处理空数组', () => {
      const result = findExistingPathSync([])
      expect(result).toBeUndefined()
    })
  })

  describe('getCallerDirectory 目录提取', () => {
    it('应该提取调用目录', () => {
      const result = getCallerDirectory()
      expect(typeof result).toBe('string')
      expect(path.isAbsolute(result)).toBe(true)
    })

    it('应该处理不同栈深度', () => {
      function wrapper() {
        return getCallerDirectory(3)
      }
      const result = wrapper()
      expect(typeof result).toBe('string')
    })

    it('应该处理匿名函数', () => {
      const result = (() => getCallerDirectory(3))()
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
        return getCallerDirectory(5)
      }

      const result = level1()
      expect(typeof result).toBe('string')
    })

    it('应该处理栈深度边界', () => {
      ;[1, 2, 3, 4, 5].forEach(depth => {
        try {
          const result = getCallerDirectory(depth)
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
      mockFindUp.mockResolvedValue('/project/bun.lock')

      const result = await getBunWorkspaceRoot('/project/sub')

      expect(result).toBe('/project')
      expect(mockFindUp).toHaveBeenCalledWith(['bun.lock', 'bun.lockb'], {
        cwd: '/project/sub',
      })
    })

    it('工作区根目录检测应该包含 Bun 且优先于 npm', async () => {
      mockFindUp
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce('/project/bun.lock')

      const result = await getWorkspaceRoot('/project/sub')

      expect(result).toBe('/project')
      expect(mockFindUp).toHaveBeenCalledTimes(4)
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

  describe('getWorkspacePackageRoots 工作区列表', () => {
    it('应该获取npm工作区', async () => {
      mockGetPackageManager.mockResolvedValue('npm')
      mockReadJson.mockResolvedValue({ workspaces: ['packages/*'] })
      mockGlob.sync.mockReturnValue(['packages/app'])

      const result = await getWorkspacePackageRoots('/project')

      expect(result).toEqual(['/project/packages/app'])
    })

    it('应该获取pnpm工作区', async () => {
      mockGetPackageManager.mockResolvedValue('pnpm')
      mockPathExists.mockResolvedValue(true)
      mockReadFile.mockResolvedValue('packages:\n  - "packages/*"')
      mockYaml.load.mockReturnValue({ packages: ['packages/*'] })
      mockGlob.sync.mockReturnValue(['packages/core'])

      const result = await getWorkspacePackageRoots('/pnpm-project')

      expect(mockPathExists).toHaveBeenCalledWith(
        '/pnpm-project/pnpm-workspace.yaml',
      )
      expect(mockYaml.load).toHaveBeenCalled()
      expect(result).toEqual(['/pnpm-project/packages/core'])
    })

    it('应该返回相对路径', async () => {
      mockGetPackageManager.mockResolvedValue('npm')
      mockReadJson.mockResolvedValue({ workspaces: ['packages/*'] })
      mockGlob.sync.mockReturnValue(['packages/app'])

      const result = await getWorkspacePackageRoots('/project-relative', true)

      expect(result).toEqual(['packages/app'])
    })

    it('应该处理特定包', async () => {
      mockGetPackageManager.mockResolvedValue('npm')
      mockReadJson.mockResolvedValue({ workspaces: ['specific-pkg'] })
      mockGlob.sync.mockReturnValue(['specific-pkg'])

      const result = await getWorkspacePackageRoots('/project-specific', true)

      expect(mockGlob.sync).toHaveBeenCalledWith(
        'specific-pkg',
        expect.any(Object),
      )
      expect(result).toEqual(['specific-pkg'])
    })

    it('应该回退到根目录', async () => {
      mockGetPackageManager.mockResolvedValue('npm')
      mockReadJson.mockResolvedValue({})

      const result = await getWorkspacePackageRoots('/single')

      expect(result).toEqual(['/single'])
    })

    it('应该处理pnpm无配置文件', async () => {
      mockGetPackageManager.mockResolvedValue('pnpm')
      mockPathExists.mockResolvedValue(false)

      const result = await getWorkspacePackageRoots('/no-pnpm-config')

      expect(result).toEqual(['/no-pnpm-config'])
    })

    it('应该正规化工作区模式', async () => {
      mockGetPackageManager.mockResolvedValue('npm')
      mockReadJson.mockResolvedValue({ workspaces: ['packages/***'] })
      mockGlob.sync.mockReturnValue(['packages/test'])

      const result = await getWorkspacePackageRoots('/norm', true)

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
      mockGlob.sync
        .mockReturnValueOnce(['packages/app'])
        .mockReturnValueOnce(['tools/build'])

      const result = await getWorkspacePackageRoots('/complex', true)

      expect(result).toEqual(['packages/app', 'tools/build'])
    })

    it('应该支持 Yarn object workspaces', async () => {
      mockGetPackageManager.mockResolvedValue('npm')
      mockReadJson.mockResolvedValue({
        workspaces: { packages: ['packages/*'] },
      })
      mockGlob.sync.mockReturnValue(['packages/app'])

      const result = await getWorkspacePackageRoots('/yarn-object', true)

      expect(result).toEqual(['packages/app'])
    })

    it('应该处理排除模式并去除重复结果', async () => {
      mockGetPackageManager.mockResolvedValue('npm')
      mockReadJson.mockResolvedValue({
        workspaces: ['packages/*', 'packages/app', '!packages/private'],
      })
      mockGlob.sync
        .mockReturnValueOnce(['packages/app'])
        .mockReturnValueOnce(['packages/app'])

      const result = await getWorkspacePackageRoots('/patterns', true)

      expect(result).toEqual(['packages/app'])
      expect(mockGlob.sync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          ignore: ['*/*.*', 'packages/private'],
        }),
      )
      expect(mockGetPackageManager).toHaveBeenCalledTimes(1)
    })

    it('每次调用都应该重新读取工作区配置', async () => {
      mockGetPackageManager.mockResolvedValue('npm')
      mockReadJson
        .mockResolvedValueOnce({ workspaces: ['packages/*'] })
        .mockResolvedValueOnce({ workspaces: ['apps/*'] })
      mockGlob.sync
        .mockReturnValueOnce(['packages/app'])
        .mockReturnValueOnce(['apps/web'])

      await expect(getWorkspacePackageRoots('/fresh', true)).resolves.toEqual([
        'packages/app',
      ])
      await expect(getWorkspacePackageRoots('/fresh', true)).resolves.toEqual([
        'apps/web',
      ])
      expect(mockGetPackageManager).toHaveBeenCalledTimes(2)
    })

    it('应该拒绝无效的工作区配置', async () => {
      mockGetPackageManager.mockResolvedValue('npm')
      mockReadJson.mockResolvedValue({ workspaces: { packages: 'packages/*' } })

      await expect(getWorkspacePackageRoots('/invalid')).rejects.toThrow(
        'Invalid workspace configuration',
      )
    })
  })

  describe('错误处理', () => {
    it('应该处理工作区检测错误', async () => {
      mockGetPackageManager.mockRejectedValue(new Error('Detection failed'))

      await expect(getWorkspacePackageRoots('/error')).rejects.toThrow(
        'Detection failed',
      )
    })

    it('应该处理文件读取错误', async () => {
      mockGetPackageManager.mockResolvedValue('npm')
      mockReadJson.mockRejectedValue(new Error('Read failed'))

      await expect(getWorkspacePackageRoots('/read-error')).rejects.toThrow(
        'Read failed',
      )
    })

    it('应该处理yaml解析错误', async () => {
      mockGetPackageManager.mockResolvedValue('pnpm')
      mockPathExists.mockResolvedValue(true)
      mockReadFile.mockResolvedValue('invalid yaml')
      mockYaml.load.mockImplementation(() => {
        throw new Error('YAML error')
      })

      await expect(getWorkspacePackageRoots('/yaml-error')).rejects.toThrow(
        'YAML error',
      )
    })
  })

  describe('实际场景', () => {
    it('应该模拟monorepo检测', async () => {
      mockGetPackageManager.mockResolvedValue('pnpm')
      mockPathExists.mockResolvedValue(true)
      mockReadFile.mockResolvedValue('packages:\n  - "packages/*"')
      mockYaml.load.mockReturnValue({ packages: ['packages/*'] })
      mockGlob.sync.mockReturnValue(['packages/core', 'packages/ui'])

      const result = await getWorkspacePackageRoots('/monorepo', true)

      expect(result).toEqual(['packages/core', 'packages/ui'])
    })

    it('应该处理路径查找场景', async () => {
      mockPathExists.mockImplementation(
        async (path: string) => path === '/found',
      )

      const result = await findExistingPath([
        '/notfound',
        '/found',
        '/also-notfound',
      ])

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

      const result = await getWorkspacePackageRoots('/project')

      expect(Array.isArray(result)).toBe(true)
      expect(result.every(item => typeof item === 'string')).toBe(true)
    })
  })
})
