/**
 * @file packages/release internal/plugins/bootstrap 模块单元测试
 * @description 测试 bootstrap.ts 引导插件功能
 */

import {
  getGitBranch,
  getGitLatestTag,
  getWorkspaces,
  isPathExists,
  logger,
  readJson,
} from '@eljs/utils'
import path from 'node:path'

import bootstrapPlugin from '../../src/internal/plugins/bootstrap'
import type { Api, AppData } from '../../src/types'

// 模拟依赖
jest.mock('@eljs/utils', () => ({
  chalk: {
    cyan: jest.fn((text: string) => `[cyan]${text}[/cyan]`),
  },
  getGitBranch: jest.fn(),
  getGitLatestTag: jest.fn(),
  getWorkspaces: jest.fn(),
  isPathExists: jest.fn(),
  logger: {
    warn: jest.fn(),
  },
  readJson: jest.fn(),
}))

jest.mock('node:path')
jest.mock('../../src/utils', () => ({
  AppError: jest.fn().mockImplementation((message: string) => {
    const error = new Error(message)
    error.name = 'AppError'
    return error
  }),
}))

describe('Bootstrap 插件测试', () => {
  let mockApi: Partial<Api> & {
    modifyAppData: jest.MockedFunction<Api['modifyAppData']>
  }
  const mockCwd = '/test/project'

  beforeEach(() => {
    mockApi = {
      modifyAppData: jest.fn(),
    }

    // 重置所有模拟
    jest.clearAllMocks()

    // 设置默认模拟
    ;(
      getWorkspaces as jest.MockedFunction<typeof getWorkspaces>
    ).mockResolvedValue([])
    ;(
      isPathExists as jest.MockedFunction<typeof isPathExists>
    ).mockResolvedValue(true)
    ;(path.join as jest.MockedFunction<typeof path.join>).mockImplementation(
      (...args) => args.join('/'),
    )
    ;(
      getGitBranch as jest.MockedFunction<typeof getGitBranch>
    ).mockResolvedValue('main')
    ;(
      getGitLatestTag as jest.MockedFunction<typeof getGitLatestTag>
    ).mockResolvedValue('v1.0.0')
  })

  describe('插件注册', () => {
    test('应该注册 modifyAppData 方法', () => {
      bootstrapPlugin(mockApi as unknown as Api)

      expect(mockApi.modifyAppData).toHaveBeenCalledTimes(1)
      expect(typeof mockApi.modifyAppData.mock.calls[0][0]).toBe('function')
    })
  })

  describe('modifyAppData 功能', () => {
    test('应该处理单个包的项目', async () => {
      const mockPackageJson = {
        name: 'test-package',
        version: '1.0.0',
        private: false,
      }

      ;(
        getWorkspaces as jest.MockedFunction<typeof getWorkspaces>
      ).mockResolvedValue([mockCwd])
      ;(readJson as jest.MockedFunction<typeof readJson>).mockResolvedValue(
        mockPackageJson,
      )

      bootstrapPlugin(mockApi as unknown as Api)
      const modifyAppDataFn = mockApi.modifyAppData.mock.calls[0][0]

      // 创建部分 AppData 对象进行测试
      const memo = {
        projectPkg: {
          publishConfig: {
            registry: 'https://registry.npmjs.org',
          },
        },
      }

      const result = await modifyAppDataFn(memo as unknown as AppData, {
        cwd: mockCwd,
      })

      expect(result).toEqual(
        expect.objectContaining({
          pkgJsonPaths: [`${mockCwd}/package.json`],
          pkgs: [mockPackageJson],
          pkgNames: ['test-package'],
          validPkgRootPaths: [mockCwd],
          validPkgNames: ['test-package'],
          registry: 'https://registry.npmjs.org',
          branch: 'main',
          latestTag: 'v1.0.0',
        }),
      )
    })

    test('应该处理 monorepo 项目', async () => {
      const workspaces = [
        '/test/project/packages/pkg1',
        '/test/project/packages/pkg2',
        '/test/project/packages/pkg3',
      ]

      const mockPackages = [
        { name: 'pkg1', version: '1.0.0', private: false },
        { name: 'pkg2', version: '1.0.0', private: true }, // private 包
        { name: 'pkg3', version: '1.0.0', private: false },
      ]

      ;(
        getWorkspaces as jest.MockedFunction<typeof getWorkspaces>
      ).mockResolvedValue(workspaces)
      ;(readJson as jest.MockedFunction<typeof readJson>)
        .mockResolvedValueOnce(mockPackages[0])
        .mockResolvedValueOnce(mockPackages[1])
        .mockResolvedValueOnce(mockPackages[2])

      bootstrapPlugin(mockApi as unknown as Api)
      const modifyAppDataFn = mockApi.modifyAppData.mock.calls[0][0]

      const memo = { projectPkg: {} }
      const result = await modifyAppDataFn(memo as unknown as AppData, {
        cwd: mockCwd,
      })

      expect(result.pkgJsonPaths).toHaveLength(3)
      expect(result.pkgs).toEqual(mockPackages)
      expect(result.pkgNames).toEqual(['pkg1', 'pkg2', 'pkg3'])
      expect(result.validPkgRootPaths).toEqual([
        '/test/project/packages/pkg1',
        '/test/project/packages/pkg3',
      ]) // 排除 private 包
      expect(result.validPkgNames).toEqual(['pkg1', 'pkg3'])
    })

    test('应该跳过不存在 package.json 的目录', async () => {
      const workspaces = [
        '/test/project/packages/pkg1',
        '/test/project/packages/pkg2',
      ]

      ;(
        getWorkspaces as jest.MockedFunction<typeof getWorkspaces>
      ).mockResolvedValue(workspaces)
      ;(isPathExists as jest.MockedFunction<typeof isPathExists>)
        .mockResolvedValueOnce(true) // pkg1 存在
        .mockResolvedValueOnce(false) // pkg2 不存在
      ;(readJson as jest.MockedFunction<typeof readJson>).mockResolvedValue({
        name: 'pkg1',
        version: '1.0.0',
        private: false,
      })

      bootstrapPlugin(mockApi as unknown as Api)
      const modifyAppDataFn = mockApi.modifyAppData.mock.calls[0][0]

      const memo = { projectPkg: {} }
      const result = await modifyAppDataFn(memo as unknown as AppData, {
        cwd: mockCwd,
      })

      expect(result.pkgJsonPaths).toHaveLength(1)
      expect(result.pkgNames).toEqual(['pkg1'])
      expect(readJson).toHaveBeenCalledTimes(1)
    })

    test('应该警告没有名称的包并跳过', async () => {
      const mockPackageWithoutName = {
        version: '1.0.0',
        // 缺少 name 字段
      }

      // 同时添加一个有效的包，以避免触发 "No valid package to publish" 错误
      const validPackage = {
        name: 'valid-package',
        version: '1.0.0',
        private: false,
      }

      ;(
        getWorkspaces as jest.MockedFunction<typeof getWorkspaces>
      ).mockResolvedValue([mockCwd, '/test/valid-package'])
      ;(readJson as jest.MockedFunction<typeof readJson>)
        .mockResolvedValueOnce(mockPackageWithoutName)
        .mockResolvedValueOnce(validPackage)

      bootstrapPlugin(mockApi as unknown as Api)
      const modifyAppDataFn = mockApi.modifyAppData.mock.calls[0][0]

      const memo = { projectPkg: {} }
      const result = await modifyAppDataFn(memo as unknown as AppData, {
        cwd: mockCwd,
      })

      expect(logger.warn).toHaveBeenCalledWith(
        'No name field was found in [cyan]/test/project/package.json[/cyan], skipped.',
      )
      // 应该只包含有效的包
      expect(result.pkgNames).toEqual(['valid-package'])
      expect(result.validPkgNames).toEqual(['valid-package'])
    })

    test('应该正确区分公开包和私有包', async () => {
      const workspaces = [
        '/test/project/packages/public-pkg',
        '/test/project/packages/private-pkg',
      ]

      ;(
        getWorkspaces as jest.MockedFunction<typeof getWorkspaces>
      ).mockResolvedValue(workspaces)
      ;(readJson as jest.MockedFunction<typeof readJson>)
        .mockResolvedValueOnce({
          name: 'public-pkg',
          version: '1.0.0',
          private: false,
        })
        .mockResolvedValueOnce({
          name: 'private-pkg',
          version: '1.0.0',
          private: true,
        })

      bootstrapPlugin(mockApi as unknown as Api)
      const modifyAppDataFn = mockApi.modifyAppData.mock.calls[0][0]

      const memo = { projectPkg: {} }
      const result = await modifyAppDataFn(memo as unknown as AppData, {
        cwd: mockCwd,
      })

      expect(result.pkgNames).toEqual(['public-pkg', 'private-pkg'])
      expect(result.validPkgNames).toEqual(['public-pkg'])
      expect(result.validPkgRootPaths).toEqual([
        '/test/project/packages/public-pkg',
      ])
    })

    test('应该获取 Git 相关信息', async () => {
      ;(
        getWorkspaces as jest.MockedFunction<typeof getWorkspaces>
      ).mockResolvedValue([mockCwd])
      ;(readJson as jest.MockedFunction<typeof readJson>).mockResolvedValue({
        name: 'test-pkg',
        version: '1.0.0',
        private: false,
      })
      ;(
        getGitBranch as jest.MockedFunction<typeof getGitBranch>
      ).mockResolvedValue('develop')
      ;(
        getGitLatestTag as jest.MockedFunction<typeof getGitLatestTag>
      ).mockResolvedValue('v1.2.0')

      bootstrapPlugin(mockApi as unknown as Api)
      const modifyAppDataFn = mockApi.modifyAppData.mock.calls[0][0]

      const memo = { projectPkg: {} }
      const result = await modifyAppDataFn(memo as unknown as AppData, {
        cwd: mockCwd,
      })

      expect(getGitBranch).toHaveBeenCalledWith({ cwd: mockCwd })
      expect(getGitLatestTag).toHaveBeenCalledWith({ cwd: mockCwd })
      expect(result.branch).toBe('develop')
      expect(result.latestTag).toBe('v1.2.0')
    })

    test('应该从项目配置中获取 registry', async () => {
      ;(
        getWorkspaces as jest.MockedFunction<typeof getWorkspaces>
      ).mockResolvedValue([mockCwd])
      ;(readJson as jest.MockedFunction<typeof readJson>).mockResolvedValue({
        name: 'test-pkg',
        version: '1.0.0',
        private: false,
      })

      bootstrapPlugin(mockApi as unknown as Api)
      const modifyAppDataFn = mockApi.modifyAppData.mock.calls[0][0]

      const memo = {
        projectPkg: {
          publishConfig: {
            registry: 'https://custom-registry.com',
          },
        },
      }

      const result = await modifyAppDataFn(memo as unknown as AppData, {
        cwd: mockCwd,
      })

      expect(result.registry).toBe('https://custom-registry.com')
    })

    test('当没有有效包时应该抛出 AppError', async () => {
      ;(
        getWorkspaces as jest.MockedFunction<typeof getWorkspaces>
      ).mockResolvedValue([mockCwd])
      ;(readJson as jest.MockedFunction<typeof readJson>).mockResolvedValue({
        name: 'private-pkg',
        version: '1.0.0',
        private: true, // 只有私有包
      })

      bootstrapPlugin(mockApi as unknown as Api)
      const modifyAppDataFn = mockApi.modifyAppData.mock.calls[0][0]

      const memo = { projectPkg: {} }

      await expect(
        modifyAppDataFn(memo as unknown as AppData, { cwd: mockCwd }),
      ).rejects.toThrow(
        'No valid package to publish in [cyan]/test/project[/cyan].',
      )
    })

    test('应该处理空的工作空间列表', async () => {
      ;(
        getWorkspaces as jest.MockedFunction<typeof getWorkspaces>
      ).mockResolvedValue([])

      bootstrapPlugin(mockApi as unknown as Api)
      const modifyAppDataFn = mockApi.modifyAppData.mock.calls[0][0]

      const memo = { projectPkg: {} }

      await expect(
        modifyAppDataFn(memo as unknown as AppData, { cwd: mockCwd }),
      ).rejects.toThrow('No valid package to publish')
    })

    test('应该保持原有的 memo 属性', async () => {
      ;(
        getWorkspaces as jest.MockedFunction<typeof getWorkspaces>
      ).mockResolvedValue([mockCwd])
      ;(readJson as jest.MockedFunction<typeof readJson>).mockResolvedValue({
        name: 'test-pkg',
        version: '1.0.0',
        private: false,
      })

      bootstrapPlugin(mockApi as unknown as Api)
      const modifyAppDataFn = mockApi.modifyAppData.mock.calls[0][0]

      const memo = {
        existingProperty: 'existing-value',
        projectPkg: {},
      }

      const result = await modifyAppDataFn(memo as unknown as AppData, {
        cwd: mockCwd,
      })

      expect(
        (result as AppData & { existingProperty: string }).existingProperty,
      ).toBe('existing-value')
      expect(result.pkgNames).toEqual(['test-pkg'])
    })
  })

  describe('错误处理', () => {
    test('应该处理 getWorkspaces 抛出的错误', async () => {
      ;(
        getWorkspaces as jest.MockedFunction<typeof getWorkspaces>
      ).mockRejectedValue(new Error('获取工作空间失败'))

      bootstrapPlugin(mockApi as unknown as Api)
      const modifyAppDataFn = mockApi.modifyAppData.mock.calls[0][0]

      const memo = { projectPkg: {} }

      await expect(
        modifyAppDataFn(memo as unknown as AppData, { cwd: mockCwd }),
      ).rejects.toThrow('获取工作空间失败')
    })

    test('应该处理 readJson 抛出的错误', async () => {
      ;(
        getWorkspaces as jest.MockedFunction<typeof getWorkspaces>
      ).mockResolvedValue([mockCwd])
      ;(readJson as jest.MockedFunction<typeof readJson>).mockRejectedValue(
        new Error('读取 package.json 失败'),
      )

      bootstrapPlugin(mockApi as unknown as Api)
      const modifyAppDataFn = mockApi.modifyAppData.mock.calls[0][0]

      const memo = { projectPkg: {} }

      await expect(
        modifyAppDataFn(memo as unknown as AppData, { cwd: mockCwd }),
      ).rejects.toThrow('读取 package.json 失败')
    })

    test('应该处理 getGitBranch 抛出的错误', async () => {
      ;(
        getWorkspaces as jest.MockedFunction<typeof getWorkspaces>
      ).mockResolvedValue([mockCwd])
      ;(readJson as jest.MockedFunction<typeof readJson>).mockResolvedValue({
        name: 'test-pkg',
        version: '1.0.0',
        private: false,
      })
      ;(
        getGitBranch as jest.MockedFunction<typeof getGitBranch>
      ).mockRejectedValue(new Error('获取分支失败'))

      bootstrapPlugin(mockApi as unknown as Api)
      const modifyAppDataFn = mockApi.modifyAppData.mock.calls[0][0]

      const memo = { projectPkg: {} }

      await expect(
        modifyAppDataFn(memo as unknown as AppData, { cwd: mockCwd }),
      ).rejects.toThrow('获取分支失败')
    })
  })

  describe('插件导出验证', () => {
    test('应该是一个函数', () => {
      expect(typeof bootstrapPlugin).toBe('function')
    })

    test('应该接受 API 参数', () => {
      expect(bootstrapPlugin.length).toBe(1)
    })

    test('应该没有返回值', () => {
      const result = bootstrapPlugin(mockApi as unknown as Api)
      expect(result).toBeUndefined()
    })
  })
})
