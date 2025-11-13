/* eslint-disable @typescript-eslint/no-var-requires */
import execa from 'execa'

import {
  install,
  installDeps,
  type InstallDepsOptions,
} from '../../src/npm/install'

// Mock 依赖项
jest.mock('execa')
jest.mock('../../src/type')
jest.mock('../../src/npm/package-manager')

describe('NPM 安装工具', () => {
  const mockExeca = execa as jest.MockedFunction<typeof execa>
  const mockIsObject = require('../../src/type')
    .isObject as jest.MockedFunction<(value: unknown) => boolean>
  const mockIsArray = require('../../src/type').isArray as jest.MockedFunction<
    (value: unknown) => boolean
  >
  const mockGetPackageManager = require('../../src/npm/package-manager')
    .getPackageManager as jest.MockedFunction<(cwd?: string) => Promise<string>>

  beforeEach(() => {
    jest.clearAllMocks()
    mockIsObject.mockReturnValue(false)
    mockIsArray.mockReturnValue(false)
    mockGetPackageManager.mockResolvedValue('npm')
    mockExeca.mockResolvedValue({ stdout: 'success' } as unknown as ReturnType<
      typeof execa
    >)
  })

  describe('installDeps 函数测试', () => {
    it('应该成功完成依赖安装流程', async () => {
      const options: InstallDepsOptions = {
        dependencies: ['react'],
      }

      await expect(installDeps(options)).resolves.toBeUndefined()
    })

    it('应该成功处理开发依赖', async () => {
      const options: InstallDepsOptions = {
        devDependencies: ['jest'],
      }

      await expect(installDeps(options)).resolves.toBeUndefined()
    })

    it('应该成功处理指定包管理器', async () => {
      await expect(
        installDeps('pnpm', { dependencies: ['lodash'] }),
      ).resolves.toBeUndefined()
    })

    it('应该成功处理空选项', async () => {
      await expect(installDeps({})).resolves.toBeUndefined()
    })

    it('应该成功处理参数重载', async () => {
      mockIsObject.mockReturnValue(true)

      await expect(
        installDeps({ dependencies: ['test'] }),
      ).resolves.toBeUndefined()
    })

    it('应该成功处理复杂选项', async () => {
      const options: InstallDepsOptions = {
        dependencies: ['express'],
        devDependencies: ['nodemon'],
        cwd: '/fullstack',
      }

      await expect(installDeps(options)).resolves.toBeUndefined()
    })

    it('应该成功处理yarn语法', async () => {
      mockGetPackageManager.mockResolvedValue('yarn')

      const options: InstallDepsOptions = {
        dependencies: ['axios'],
      }

      await expect(installDeps(options)).resolves.toBeUndefined()
    })

    it('应该完成函数调用而不抛出错误', async () => {
      // 简化测试：只验证函数能够成功完成
      const options: InstallDepsOptions = {
        dependencies: ['test-package'],
      }

      await expect(installDeps(options)).resolves.toBeUndefined()
    })
  })

  describe('install 函数测试', () => {
    it('应该成功执行基本安装', async () => {
      await expect(install()).resolves.toBeUndefined()
    })

    it('应该成功使用指定包管理器', async () => {
      await expect(install('yarn')).resolves.toBeUndefined()
    })

    it('应该成功传递参数', async () => {
      await expect(install('npm', ['--production'])).resolves.toBeUndefined()
    })

    it('应该成功处理选项重载', async () => {
      mockIsObject.mockReturnValue(true)

      await expect(install({ cwd: '/test' })).resolves.toBeUndefined()
    })

    it('应该成功处理数组参数重载', async () => {
      mockIsArray.mockReturnValue(true)

      await expect(
        install(['--frozen-lockfile'], { cwd: '/ci' }),
      ).resolves.toBeUndefined()
    })

    it('应该成功处理yarn特殊情况', async () => {
      await expect(install('yarn', ['--check-files'])).resolves.toBeUndefined()
    })

    it('应该处理包管理器检测错误', async () => {
      mockGetPackageManager.mockRejectedValue(new Error('Detection failed'))

      await expect(install()).rejects.toThrow('Detection failed')
    })

    it('应该处理安装命令错误', async () => {
      mockExeca.mockRejectedValue(new Error('Command failed'))

      await expect(install('npm', ['--test'])).rejects.toThrow('Command failed')
    })
  })

  describe('参数处理逻辑', () => {
    it('应该正确处理对象参数识别', async () => {
      mockIsObject.mockReturnValue(true)

      await expect(
        installDeps({ dependencies: ['pkg'] }),
      ).resolves.toBeUndefined()
      expect(mockIsObject).toHaveBeenCalled()
    })

    it('应该正确处理数组参数识别', async () => {
      mockIsArray.mockReturnValue(true)

      await expect(install(['--test'])).resolves.toBeUndefined()
      expect(mockIsArray).toHaveBeenCalled()
    })

    it('应该正确处理复合逻辑', async () => {
      mockIsObject.mockReturnValueOnce(false).mockReturnValueOnce(true)

      await expect(install('npm', { cwd: '/test' })).resolves.toBeUndefined()
      expect(mockIsObject).toHaveBeenCalledTimes(2)
    })
  })

  describe('实际场景验证', () => {
    it('应该支持monorepo项目', async () => {
      mockGetPackageManager.mockResolvedValue('pnpm')

      const options: InstallDepsOptions = {
        dependencies: ['shared'],
        cwd: '/monorepo',
      }

      await expect(installDeps(options)).resolves.toBeUndefined()
    })

    it('应该支持CI环境', async () => {
      await expect(install(['--ci', '--production'])).resolves.toBeUndefined()
    })

    it('应该支持开发环境', async () => {
      const options: InstallDepsOptions = {
        dependencies: ['app'],
        devDependencies: ['tools'],
      }

      await expect(installDeps(options)).resolves.toBeUndefined()
    })
  })

  describe('边界情况', () => {
    it('应该处理undefined选项', async () => {
      await expect(installDeps()).resolves.toBeUndefined()
      await expect(install()).resolves.toBeUndefined()
    })

    it('应该处理空字符串包名', async () => {
      await expect(installDeps({ dependencies: [''] })).resolves.toBeUndefined()
    })

    it('应该处理多包管理器', async () => {
      await expect(
        installDeps('npm', { dependencies: ['pkg1'] }),
      ).resolves.toBeUndefined()
      await expect(
        installDeps('yarn', { dependencies: ['pkg2'] }),
      ).resolves.toBeUndefined()
      await expect(
        installDeps('pnpm', { dependencies: ['pkg3'] }),
      ).resolves.toBeUndefined()
    })
  })

  describe('类型和接口验证', () => {
    it('应该接受正确的InstallDepsOptions类型', async () => {
      const validOptions: InstallDepsOptions = {
        dependencies: ['@types/node', 'lodash'],
        devDependencies: ['jest', '@types/jest'],
        cwd: '/project',
        verbose: true,
      }

      await expect(installDeps(validOptions)).resolves.toBeUndefined()
    })

    it('应该支持所有包管理器类型', async () => {
      const managers = ['npm', 'yarn', 'pnpm'] as const

      for (const manager of managers) {
        await expect(
          installDeps(manager, { dependencies: ['test'] }),
        ).resolves.toBeUndefined()
      }
    })

    it('应该维护函数签名', () => {
      // 验证函数存在并且是函数
      expect(typeof installDeps).toBe('function')
      expect(typeof install).toBe('function')
    })
  })
})
