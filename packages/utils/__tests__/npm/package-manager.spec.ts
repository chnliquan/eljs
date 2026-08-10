import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest'
import * as importedModule0 from '../../src/env'
import * as importedModule1 from '../../src/path/workspace-lock'

import { getPackageManager } from '../../src/npm/package-manager'

const requiredModule0 = vi.mocked(importedModule0, { deep: true })
const requiredModule1 = vi.mocked(importedModule1, { deep: true })

// Mock 依赖项
vi.mock('../../src/env')
vi.mock('../../src/path/workspace-lock')

describe('Package Manager 工具', () => {
  const mockHasGlobalInstallation =
    requiredModule0.hasGlobalInstallation as MockedFunction<
      (bin: string) => Promise<boolean>
    >
  const mockGetPnpmWorkspaceRoot =
    requiredModule1.getPnpmWorkspaceRoot as MockedFunction<
      (cwd: string) => Promise<string | null>
    >
  const mockGetYarnWorkspaceRoot =
    requiredModule1.getYarnWorkspaceRoot as MockedFunction<
      (cwd: string) => Promise<string | null>
    >
  const mockGetBunWorkspaceRoot =
    requiredModule1.getBunWorkspaceRoot as MockedFunction<
      (cwd: string) => Promise<string | null>
    >
  const mockGetNpmWorkspaceRoot =
    requiredModule1.getNpmWorkspaceRoot as MockedFunction<
      (cwd: string) => Promise<string | null>
    >

  beforeEach(() => {
    vi.clearAllMocks()

    // 设置默认 mock 行为
    mockHasGlobalInstallation.mockResolvedValue(false)
    mockGetPnpmWorkspaceRoot.mockResolvedValue(null)
    mockGetYarnWorkspaceRoot.mockResolvedValue(null)
    mockGetBunWorkspaceRoot.mockResolvedValue(null)
    mockGetNpmWorkspaceRoot.mockResolvedValue(null)
  })

  describe('getPackageManager', () => {
    it('应该检测 pnpm 通过 lock 文件', async () => {
      mockGetPnpmWorkspaceRoot.mockResolvedValue('/project')

      const result = await getPackageManager('/project')

      expect(mockGetPnpmWorkspaceRoot).toHaveBeenCalledWith('/project')
      expect(result).toBe('pnpm')
    })

    it('应该检测 yarn 通过 lock 文件', async () => {
      mockGetPnpmWorkspaceRoot.mockResolvedValue(null)
      mockGetYarnWorkspaceRoot.mockResolvedValue('/project')

      const result = await getPackageManager('/project')

      expect(mockGetYarnWorkspaceRoot).toHaveBeenCalledWith('/project')
      expect(result).toBe('yarn')
    })

    it('应该检测 npm 通过 lock 文件', async () => {
      mockGetPnpmWorkspaceRoot.mockResolvedValue(null)
      mockGetYarnWorkspaceRoot.mockResolvedValue(null)
      mockGetNpmWorkspaceRoot.mockResolvedValue('/project')

      const result = await getPackageManager('/project')

      expect(mockGetNpmWorkspaceRoot).toHaveBeenCalledWith('/project')
      expect(result).toBe('npm')
    })

    it('应该检测 bun 通过 lock 文件', async () => {
      mockGetBunWorkspaceRoot.mockResolvedValue('/project')

      const result = await getPackageManager('/project')

      expect(mockGetBunWorkspaceRoot).toHaveBeenCalledWith('/project')
      expect(result).toBe('bun')
    })

    it('应该回退到全局 pnpm 检测', async () => {
      // 没有 lock 文件
      mockGetPnpmWorkspaceRoot.mockResolvedValue(null)
      mockGetYarnWorkspaceRoot.mockResolvedValue(null)
      mockGetNpmWorkspaceRoot.mockResolvedValue(null)

      // 有全局 pnpm
      mockHasGlobalInstallation.mockImplementation((bin: string) => {
        return Promise.resolve(bin === 'pnpm')
      })

      const result = await getPackageManager()

      expect(mockHasGlobalInstallation).toHaveBeenCalledWith('pnpm')
      expect(mockHasGlobalInstallation).toHaveBeenCalledWith('yarn')
      expect(result).toBe('pnpm')
    })

    it('应该回退到全局 yarn 检测', async () => {
      // 没有 lock 文件，没有 pnpm，但有 yarn
      mockGetPnpmWorkspaceRoot.mockResolvedValue(null)
      mockGetYarnWorkspaceRoot.mockResolvedValue(null)
      mockGetNpmWorkspaceRoot.mockResolvedValue(null)

      mockHasGlobalInstallation.mockImplementation((bin: string) => {
        return Promise.resolve(bin === 'yarn')
      })

      const result = await getPackageManager()

      expect(result).toBe('yarn')
    })

    it('应该回退到全局 bun 检测', async () => {
      mockHasGlobalInstallation.mockImplementation((bin: string) => {
        return Promise.resolve(bin === 'bun')
      })

      const result = await getPackageManager()

      expect(result).toBe('bun')
    })

    it('应该默认使用 npm', async () => {
      // 没有任何包管理器
      mockGetPnpmWorkspaceRoot.mockResolvedValue(null)
      mockGetYarnWorkspaceRoot.mockResolvedValue(null)
      mockGetNpmWorkspaceRoot.mockResolvedValue(null)
      mockHasGlobalInstallation.mockResolvedValue(false)

      const result = await getPackageManager()

      expect(result).toBe('npm')
    })

    it('应该使用默认当前工作目录', async () => {
      const originalCwd = process.cwd()
      mockGetPnpmWorkspaceRoot.mockResolvedValue('/current')

      const result = await getPackageManager()

      expect(mockGetPnpmWorkspaceRoot).toHaveBeenCalledWith(originalCwd)
      expect(result).toBe('pnpm')
    })

    it('应该为不同目录分别检测', async () => {
      // 第一个目录有 pnpm
      mockGetPnpmWorkspaceRoot.mockResolvedValueOnce('/dir1')
      mockGetYarnWorkspaceRoot.mockResolvedValueOnce(null)
      mockGetNpmWorkspaceRoot.mockResolvedValueOnce(null)

      // 第二个目录没有任何 lock 文件，回退到全局检测
      mockGetPnpmWorkspaceRoot.mockResolvedValueOnce(null)
      mockGetYarnWorkspaceRoot.mockResolvedValueOnce(null)
      mockGetNpmWorkspaceRoot.mockResolvedValueOnce(null)
      mockHasGlobalInstallation.mockResolvedValue(false) // 默认 npm

      const result1 = await getPackageManager('/dir1')
      const result2 = await getPackageManager('/dir2')

      expect(result1).toBe('pnpm')
      expect(result2).toBe('npm')
    })
  })

  describe('lock 文件优先级', () => {
    it('应该 pnpm 优先于 yarn', async () => {
      mockGetPnpmWorkspaceRoot.mockResolvedValue('/project')
      mockGetYarnWorkspaceRoot.mockResolvedValue('/project') // 同时存在

      const result = await getPackageManager('/project')

      expect(result).toBe('pnpm') // pnpm 优先
    })

    it('应该 yarn 优先于 npm', async () => {
      mockGetPnpmWorkspaceRoot.mockResolvedValue(null)
      mockGetYarnWorkspaceRoot.mockResolvedValue('/project')
      mockGetNpmWorkspaceRoot.mockResolvedValue('/project') // 同时存在

      const result = await getPackageManager('/project')

      expect(result).toBe('yarn') // yarn 优先
    })

    it('应该 bun 优先于 npm', async () => {
      mockGetBunWorkspaceRoot.mockResolvedValue('/project')
      mockGetNpmWorkspaceRoot.mockResolvedValue('/project')

      const result = await getPackageManager('/project')

      expect(result).toBe('bun')
    })

    it('应该 lock 文件优先于全局安装', async () => {
      // 有 npm lock 文件
      mockGetPnpmWorkspaceRoot.mockResolvedValue(null)
      mockGetYarnWorkspaceRoot.mockResolvedValue(null)
      mockGetNpmWorkspaceRoot.mockResolvedValue('/project')

      // 同时有全局 pnpm
      mockHasGlobalInstallation.mockResolvedValue(true)

      const result = await getPackageManager('/project')

      expect(result).toBe('npm') // lock 文件优先
      expect(mockHasGlobalInstallation).not.toHaveBeenCalled() // 不应该检查全局安装
    })
  })

  describe('错误处理', () => {
    it('应该处理 workspace 检测失败', async () => {
      // 当 Promise.all 中的任何一个失败时，整个函数会抛出错误
      mockGetPnpmWorkspaceRoot.mockRejectedValue(new Error('Access denied'))
      mockGetYarnWorkspaceRoot.mockResolvedValue(null) // 其他的正常
      mockGetNpmWorkspaceRoot.mockResolvedValue(null)

      // 应该抛出错误，然后回退到全局检测
      mockHasGlobalInstallation.mockResolvedValue(false)

      await expect(getPackageManager('/restricted')).rejects.toThrow(
        'Access denied',
      )
    })

    it('应该处理全局安装检测失败', async () => {
      mockGetPnpmWorkspaceRoot.mockResolvedValue(null)
      mockGetYarnWorkspaceRoot.mockResolvedValue(null)
      mockGetNpmWorkspaceRoot.mockResolvedValue(null)
      mockHasGlobalInstallation.mockRejectedValue(
        new Error('Command not found'),
      )

      await expect(getPackageManager()).rejects.toThrow('Command not found')
    })
  })

  describe('文件状态变化', () => {
    it('同一目录的锁文件变化后应该重新检测', async () => {
      const testDir = '/changing-workspace'
      mockGetPnpmWorkspaceRoot
        .mockResolvedValueOnce(testDir)
        .mockResolvedValueOnce(null)
      mockGetYarnWorkspaceRoot
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(testDir)

      await expect(getPackageManager(testDir)).resolves.toBe('pnpm')
      await expect(getPackageManager(testDir)).resolves.toBe('yarn')

      expect(mockGetPnpmWorkspaceRoot).toHaveBeenCalledTimes(2)
      expect(mockGetYarnWorkspaceRoot).toHaveBeenCalledTimes(2)
    })

    it('同一目录新增锁文件后不应该沿用全局检测结果', async () => {
      const testDir = '/new-lockfile-workspace'
      mockGetPnpmWorkspaceRoot
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(testDir)
      mockHasGlobalInstallation.mockResolvedValue(false)

      await expect(getPackageManager(testDir)).resolves.toBe('npm')
      await expect(getPackageManager(testDir)).resolves.toBe('pnpm')

      expect(mockHasGlobalInstallation).toHaveBeenCalledTimes(3)
    })
  })

  describe('边界情况', () => {
    it('应该处理空字符串路径', async () => {
      mockGetPnpmWorkspaceRoot.mockResolvedValue(null)
      mockGetYarnWorkspaceRoot.mockResolvedValue(null)
      mockGetNpmWorkspaceRoot.mockResolvedValue(null)
      mockHasGlobalInstallation.mockResolvedValue(false)

      const result = await getPackageManager('')

      expect(result).toBe('npm')
    })

    it('应该处理相对路径', async () => {
      mockGetPnpmWorkspaceRoot.mockResolvedValue('./relative-path')

      const result = await getPackageManager('./test')

      expect(result).toBe('pnpm')
      expect(mockGetPnpmWorkspaceRoot).toHaveBeenCalledWith('./test')
    })

    it('应该处理深层嵌套路径', async () => {
      const deepPath = '/very/deep/nested/project/sub/folder'
      mockGetPnpmWorkspaceRoot.mockResolvedValue(null)
      mockGetYarnWorkspaceRoot.mockResolvedValue(deepPath)

      const result = await getPackageManager(deepPath)

      expect(result).toBe('yarn')
    })
  })
})
