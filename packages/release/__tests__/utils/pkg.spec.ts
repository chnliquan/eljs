/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * @file packages/release utils/pkg 模块单元测试
 * @description 测试 pkg.ts 包管理相关工具函数
 */

import {
  logger,
  runCommand,
  writeJson,
  type PackageJson,
  type PackageManager,
  type RunCommandChildProcess,
} from '@eljs/utils'

import {
  updatePackageDependencies,
  updatePackageLock,
  updatePackageVersion,
} from '../../src/utils/pkg'

// 模拟依赖
jest.mock('@eljs/utils', () => ({
  logger: {
    info: jest.fn(),
  },
  runCommand: jest.fn(),
  writeJson: jest.fn(),
}))

// 简化的子进程模拟
interface MockChildProcess {
  stdout?: {
    on: jest.MockedFunction<
      (event: string, callback: (data: Buffer) => void) => void
    >
  }
  stderr?: {
    on: jest.MockedFunction<
      (event: string, callback: (data: Buffer) => void) => void
    >
  }
  on: jest.MockedFunction<
    (event: string, callback: (code: number) => void) => void
  >
  kill: jest.MockedFunction<() => void>
}

describe('包管理工具函数测试', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('updatePackageLock 函数', () => {
    let mockChild: MockChildProcess

    beforeEach(() => {
      mockChild = {
        stdout: {
          on: jest.fn(),
        },
        stderr: {
          on: jest.fn(),
        },
        on: jest.fn(),
        kill: jest.fn(),
      }
      ;(runCommand as jest.MockedFunction<typeof runCommand>).mockReturnValue(
        mockChild as unknown as RunCommandChildProcess,
      )
    })

    test('应该为 pnpm 执行正确的命令', async () => {
      const packageManager: PackageManager = 'pnpm'

      // 模拟成功的子进程
      mockChild.on.mockImplementation(
        (event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0) // 成功退出
          }
        },
      )

      await updatePackageLock(packageManager)

      expect(runCommand).toHaveBeenCalledWith(
        'pnpm install --lockfile-only',
        {},
      )
    })

    test('应该为 yarn 执行正确的命令', async () => {
      const packageManager: PackageManager = 'yarn'

      mockChild.on.mockImplementation(
        (event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0)
          }
        },
      )

      await updatePackageLock(packageManager)

      expect(runCommand).toHaveBeenCalledWith('yarn install', {})
    })

    test('应该为 bun 执行正确的命令', async () => {
      const packageManager: PackageManager = 'bun'

      mockChild.on.mockImplementation(
        (event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0)
          }
        },
      )

      await updatePackageLock(packageManager)

      expect(runCommand).toHaveBeenCalledWith('bun install --lockfile-only', {})
    })

    test('应该为 npm 执行正确的命令', async () => {
      const packageManager: PackageManager = 'npm'

      mockChild.on.mockImplementation(
        (event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0)
          }
        },
      )

      await updatePackageLock(packageManager)

      expect(runCommand).toHaveBeenCalledWith(
        'npm install --package-lock-only',
        {},
      )
    })

    test('应该传递选项给 runCommand', async () => {
      const options = { cwd: '/custom/path', timeout: 5000 }

      mockChild.on.mockImplementation(
        (event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0)
          }
        },
      )

      await updatePackageLock('pnpm', options)

      expect(runCommand).toHaveBeenCalledWith(
        'pnpm install --lockfile-only',
        options,
      )
    })

    test('应该在收到 ERR_PNPM 输出时终止进程', async () => {
      mockChild.on.mockImplementation(
        (event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0)
          }
        },
      )

      updatePackageLock('pnpm')

      // 模拟收到 ERR_PNPM 输出
      const dataCallback = mockChild.stdout!.on.mock.calls[0][1]
      dataCallback(Buffer.from('ERR_PNPM 错误信息'))

      expect(mockChild.kill).toHaveBeenCalled()
    })

    test('应该在收到 stderr 输出时终止进程', async () => {
      mockChild.on.mockImplementation(
        (event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 0)
          }
        },
      )

      updatePackageLock('pnpm')

      // 模拟收到 stderr 输出
      const dataCallback = mockChild.stderr!.on.mock.calls[0][1]
      dataCallback(Buffer.from('错误信息'))

      expect(mockChild.kill).toHaveBeenCalled()
    })

    test('应该在进程非正常退出时调用 kill 方法', async () => {
      let closeCallback: (code: number) => void = () => {}
      mockChild.on.mockImplementation(
        (event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            closeCallback = callback
          }
        },
      )

      const promise = updatePackageLock('pnpm')

      // 模拟非正常退出
      closeCallback(1) // 非正常退出码

      await promise

      expect(mockChild.kill).toHaveBeenCalled()
    })

    test('应该捕获异常并终止进程', async () => {
      ;(
        runCommand as jest.MockedFunction<typeof runCommand>
      ).mockImplementation(() => {
        throw new Error('命令执行失败')
      })

      // 应该不抛出错误
      await expect(updatePackageLock('pnpm')).resolves.toBeUndefined()
    })
  })

  describe('updatePackageVersion 函数', () => {
    test('应该更新包版本', async () => {
      const pkgJsonPath = '/test/package.json'
      const pkg: PackageJson = {
        name: 'test-package',
        version: '1.0.0',
      }
      const version = '1.1.0'

      await updatePackageVersion(pkgJsonPath, pkg, version)

      expect(pkg.version).toBe('1.1.0')
      expect(writeJson).toHaveBeenCalledWith(pkgJsonPath, pkg)
    })

    test('应该更新包版本和依赖版本', async () => {
      const pkgJsonPath = '/test/package.json'
      const pkg: PackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          '@test/dep1': '1.0.0',
          'external-dep': '2.0.0',
        },
        devDependencies: {
          '@test/dep2': '1.0.0',
        },
      }
      const version = '1.1.0'
      const pkgNames = ['@test/dep1', '@test/dep2']

      await updatePackageVersion(pkgJsonPath, pkg, version, pkgNames)

      expect(pkg.version).toBe('1.1.0')
      expect(pkg.dependencies?.['@test/dep1']).toBe('1.1.0')
      expect(pkg.dependencies?.['external-dep']).toBe('2.0.0') // 不应该被更新
      expect(pkg.devDependencies?.['@test/dep2']).toBe('1.1.0')
      expect(writeJson).toHaveBeenCalledWith(pkgJsonPath, pkg)
    })

    test('应该处理没有依赖的包', async () => {
      const pkgJsonPath = '/test/package.json'
      const pkg: PackageJson = {
        name: 'test-package',
        version: '1.0.0',
      }
      const version = '1.1.0'
      const pkgNames = ['@test/dep1']

      await updatePackageVersion(pkgJsonPath, pkg, version, pkgNames)

      expect(pkg.version).toBe('1.1.0')
      expect(writeJson).toHaveBeenCalledWith(pkgJsonPath, pkg)
    })
  })

  describe('updatePackageDependencies 函数', () => {
    test('应该更新 dependencies 中匹配的包版本', () => {
      const pkg: PackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          '@test/dep1': '1.0.0',
          '@test/dep2': '^1.0.0',
          'external-dep': '2.0.0',
        },
      }
      const version = '1.1.0'
      const pkgNames = ['@test/dep1', '@test/dep2']

      updatePackageDependencies(pkg, 'dependencies', version, pkgNames)

      expect(pkg.dependencies?.['@test/dep1']).toBe('1.1.0')
      expect(pkg.dependencies?.['@test/dep2']).toBe('1.1.0') // 正则会替换整个版本号，包括^
      expect(pkg.dependencies?.['external-dep']).toBe('2.0.0')
      expect(logger.info).toHaveBeenCalledWith(
        'test-package -> dependencies -> @test/dep1@1.1.0',
      )
      expect(logger.info).toHaveBeenCalledWith(
        'test-package -> dependencies -> @test/dep2@1.1.0',
      )
    })

    test('应该更新 devDependencies 中的版本', () => {
      const pkg: PackageJson = {
        name: 'test-package',
        version: '1.0.0',
        devDependencies: {
          '@test/dev-dep': '1.0.0-beta.1',
          jest: '^27.0.0',
        },
      }
      const version = '1.0.0-beta.2'
      const pkgNames = ['@test/dev-dep']

      updatePackageDependencies(pkg, 'devDependencies', version, pkgNames)

      expect(pkg.devDependencies?.['@test/dev-dep']).toBe('1.0.0-beta.2')
      expect(pkg.devDependencies?.['jest']).toBe('^27.0.0')
    })

    test('应该更新 peerDependencies 中的版本', () => {
      const pkg: PackageJson = {
        name: 'test-package',
        version: '1.0.0',
        peerDependencies: {
          '@test/peer-dep': '1.0.0',
          react: '^18.0.0',
        },
      }
      const version = '1.1.0'
      const pkgNames = ['@test/peer-dep']

      updatePackageDependencies(pkg, 'peerDependencies', version, pkgNames)

      expect(pkg.peerDependencies?.['@test/peer-dep']).toBe('1.1.0')
      expect(pkg.peerDependencies?.['react']).toBe('^18.0.0')
    })

    test('应该处理没有指定类型依赖的包', () => {
      const pkg: PackageJson = {
        name: 'test-package',
        version: '1.0.0',
      }
      const version = '1.1.0'
      const pkgNames = ['@test/dep']

      updatePackageDependencies(pkg, 'dependencies', version, pkgNames)

      // 应该没有错误，也没有更新任何东西
      expect(logger.info).not.toHaveBeenCalled()
    })

    test('应该正确处理复杂的版本号', () => {
      const pkg: PackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          '@test/alpha-dep': '1.0.0-alpha.1',
          '@test/beta-dep': '^2.1.0-beta.2',
          '@test/next-dep': '3.0.0-next.1',
        },
      }
      const version = '2.0.0-alpha.5'
      const pkgNames = ['@test/alpha-dep', '@test/beta-dep', '@test/next-dep']

      updatePackageDependencies(pkg, 'dependencies', version, pkgNames)

      expect(pkg.dependencies?.['@test/alpha-dep']).toBe('2.0.0-alpha.5')
      expect(pkg.dependencies?.['@test/beta-dep']).toBe('2.0.0-alpha.5') // 正则会替换整个版本号，包括^
      expect(pkg.dependencies?.['@test/next-dep']).toBe('2.0.0-alpha.5')
    })

    test('应该处理 workspace 协议', () => {
      const pkg: PackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          '@test/workspace-dep': 'workspace:^1.0.0',
          '@test/workspace-dep2': 'workspace:*',
        },
      }
      const version = '1.1.0'
      const pkgNames = ['@test/workspace-dep', '@test/workspace-dep2']

      updatePackageDependencies(pkg, 'dependencies', version, pkgNames)

      expect(pkg.dependencies?.['@test/workspace-dep']).toBe('workspace:1.1.0') // 正则也会影响workspace版本
      expect(pkg.dependencies?.['@test/workspace-dep2']).toBe('workspace:*') // 不应该被更新
    })

    test('应该对无效的 workspace 协议抛出错误', () => {
      const pkg: PackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          '@test/invalid-workspace': 'workspace: invalid',
        },
      }
      const version = '1.1.0'
      const pkgNames = ['@test/invalid-workspace']

      expect(() => {
        updatePackageDependencies(pkg, 'dependencies', version, pkgNames)
      }).toThrow(
        'Invalid workspace protocol `workspace: invalid` in `@test/invalid-workspace`.',
      )
    })

    test('应该只更新在 pkgNames 中的依赖', () => {
      const pkg: PackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          '@test/included': '1.0.0',
          '@test/excluded': '1.0.0',
          external: '1.0.0',
        },
      }
      const version = '1.1.0'
      const pkgNames = ['@test/included']

      updatePackageDependencies(pkg, 'dependencies', version, pkgNames)

      expect(pkg.dependencies?.['@test/included']).toBe('1.1.0')
      expect(pkg.dependencies?.['@test/excluded']).toBe('1.0.0')
      expect(pkg.dependencies?.['external']).toBe('1.0.0')
      expect(logger.info).toHaveBeenCalledTimes(1)
      expect(logger.info).toHaveBeenCalledWith(
        'test-package -> dependencies -> @test/included@1.1.0',
      )
    })
  })
})
