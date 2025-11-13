/* eslint-disable @typescript-eslint/no-var-requires */
import { cache, getPackageManager } from '../../src/npm/package-manager'

// Mock 依赖项
jest.mock('../../src/env')
jest.mock('../../src/path')

describe('Package Manager 工具', () => {
  const mockHasGlobalInstallation = require('../../src/env')
    .hasGlobalInstallation as jest.MockedFunction<
    (bin: string) => Promise<boolean>
  >
  const mockGetPnpmWorkspaceRoot = require('../../src/path')
    .getPnpmWorkspaceRoot as jest.MockedFunction<
    (cwd: string) => Promise<string | null>
  >
  const mockGetYarnWorkspaceRoot = require('../../src/path')
    .getYarnWorkspaceRoot as jest.MockedFunction<
    (cwd: string) => Promise<string | null>
  >
  const mockGetNpmWorkspaceRoot = require('../../src/path')
    .getNpmWorkspaceRoot as jest.MockedFunction<
    (cwd: string) => Promise<string | null>
  >

  beforeEach(() => {
    jest.clearAllMocks()

    // 清除模块内部缓存
    cache.clear()

    // 设置默认 mock 行为
    mockHasGlobalInstallation.mockResolvedValue(false)
    mockGetPnpmWorkspaceRoot.mockResolvedValue(null)
    mockGetYarnWorkspaceRoot.mockResolvedValue(null)
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

    it('应该缓存 lock 文件检测结果', async () => {
      const testDir = '/cache-test'
      mockGetPnpmWorkspaceRoot.mockResolvedValue(testDir)

      // 第一次调用
      const result1 = await getPackageManager(testDir)
      expect(result1).toBe('pnpm')
      expect(mockGetPnpmWorkspaceRoot).toHaveBeenCalledTimes(1)

      // 第二次调用应该使用缓存
      const result2 = await getPackageManager(testDir)
      expect(result2).toBe('pnpm')
      expect(mockGetPnpmWorkspaceRoot).toHaveBeenCalledTimes(1) // 没有新的调用
    })

    it('应该为不同目录分别缓存', async () => {
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

  describe('缓存机制', () => {
    it('应该正确处理缓存键', async () => {
      // 清除缓存确保测试的独立性
      cache.clear()

      const testDir = '/cache-test'

      // 第一次调用 - 应该执行实际检测
      mockGetPnpmWorkspaceRoot.mockResolvedValueOnce(testDir)
      const result1 = await getPackageManager(testDir)
      expect(result1).toBe('pnpm')

      // 第二次调用同一目录 - 应该使用缓存
      const result2 = await getPackageManager(testDir)
      expect(result2).toBe('pnpm')

      // 验证只调用了一次检测
      expect(mockGetPnpmWorkspaceRoot).toHaveBeenCalledTimes(1)
    })

    it('应该处理缓存的null值', async () => {
      const testDir = '/no-workspace'

      // 设置所有检测都返回null
      mockGetPnpmWorkspaceRoot.mockResolvedValue(null)
      mockGetYarnWorkspaceRoot.mockResolvedValue(null)
      mockGetNpmWorkspaceRoot.mockResolvedValue(null)
      mockHasGlobalInstallation.mockResolvedValue(false)

      // 第一次调用
      const result1 = await getPackageManager(testDir)
      expect(result1).toBe('npm')

      // 第二次调用应该使用缓存的null值
      const result2 = await getPackageManager(testDir)
      expect(result2).toBe('npm')

      // 验证 workspace 检测只调用了一次
      expect(mockGetPnpmWorkspaceRoot).toHaveBeenCalledTimes(1)
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
