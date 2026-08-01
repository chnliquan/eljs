import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest'

/**
 * @file packages/release utils/pkg 模块单元测试
 * @description 测试 pkg.ts 包管理相关工具函数
 */

import {
  logger,
  runCommand,
  safeWriteJson,
  type PackageJson,
  type PackageManager,
} from '@eljs/utils'

import {
  updatePackageDependencies,
  updatePackageLock,
  updatePackageVersion,
} from '../../src/utils/pkg'

// 模拟依赖
vi.mock('@eljs/utils', () => ({
  logger: {
    info: vi.fn(),
  },
  runCommand: vi.fn(),
  safeWriteJson: vi.fn(),
}))

describe('包管理工具函数测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updatePackageLock 函数', () => {
    beforeEach(() => {
      ;(runCommand as MockedFunction<typeof runCommand>).mockResolvedValue(
        {} as Awaited<ReturnType<typeof runCommand>>,
      )
    })

    it('应该为 pnpm 执行正确的命令', async () => {
      const packageManager: PackageManager = 'pnpm'

      await updatePackageLock(packageManager)

      expect(runCommand).toHaveBeenCalledWith(
        'pnpm install --lockfile-only --ignore-scripts',
        {},
      )
    })

    it('应该为 yarn 执行正确的命令', async () => {
      const packageManager: PackageManager = 'yarn'

      await updatePackageLock(packageManager)

      expect(runCommand).toHaveBeenCalledWith(
        'yarn install --ignore-scripts',
        {},
      )
    })

    it('应该为 Yarn Berry 仅更新锁文件', async () => {
      await updatePackageLock('yarn', undefined, 'yarn-berry')

      expect(runCommand).toHaveBeenCalledWith(
        'yarn install --mode=update-lockfile',
        {},
      )
    })

    it('应该为 bun 执行正确的命令', async () => {
      const packageManager: PackageManager = 'bun'

      await updatePackageLock(packageManager)

      expect(runCommand).toHaveBeenCalledWith(
        'bun install --lockfile-only --ignore-scripts',
        {},
      )
    })

    it('应该为 npm 执行正确的命令', async () => {
      const packageManager: PackageManager = 'npm'

      await updatePackageLock(packageManager)

      expect(runCommand).toHaveBeenCalledWith(
        'npm install --package-lock-only --ignore-scripts',
        {},
      )
    })

    it('应该传递选项给 runCommand', async () => {
      const options = { cwd: '/custom/path', timeout: 5000 }

      await updatePackageLock('pnpm', options)

      expect(runCommand).toHaveBeenCalledWith(
        'pnpm install --lockfile-only --ignore-scripts',
        options,
      )
    })

    it('应该允许命令成功时输出 stderr', async () => {
      ;(runCommand as MockedFunction<typeof runCommand>).mockResolvedValue({
        stderr: 'warning',
      } as Awaited<ReturnType<typeof runCommand>>)

      await expect(updatePackageLock('pnpm')).resolves.toBeUndefined()
    })

    it('应该向调用方传播命令执行失败', async () => {
      const error = new Error('命令执行失败')
      ;(runCommand as MockedFunction<typeof runCommand>).mockRejectedValue(
        error,
      )

      await expect(updatePackageLock('pnpm')).rejects.toBe(error)
    })
  })

  describe('updatePackageVersion 函数', () => {
    it('应该更新包版本', async () => {
      const pkgJsonPath = '/it/package.json'
      const pkg: PackageJson = {
        name: 'it-package',
        version: '1.0.0',
      }
      const version = '1.1.0'

      await updatePackageVersion(pkgJsonPath, pkg, version)

      expect(pkg.version).toBe('1.1.0')
      expect(safeWriteJson).toHaveBeenCalledWith(pkgJsonPath, pkg)
    })

    it('应该更新包版本和依赖版本', async () => {
      const pkgJsonPath = '/it/package.json'
      const pkg: PackageJson = {
        name: 'it-package',
        version: '1.0.0',
        dependencies: {
          '@it/dep1': '1.0.0',
          'external-dep': '2.0.0',
        },
        devDependencies: {
          '@it/dep2': '1.0.0',
        },
        optionalDependencies: {
          '@it/dep3': '^1.0.0-rc.1',
        },
      }
      const version = '1.1.0'
      const pkgNames = ['@it/dep1', '@it/dep2', '@it/dep3']

      await updatePackageVersion(pkgJsonPath, pkg, version, pkgNames)

      expect(pkg.version).toBe('1.1.0')
      expect(pkg.dependencies?.['@it/dep1']).toBe('1.1.0')
      expect(pkg.dependencies?.['external-dep']).toBe('2.0.0') // 不应该被更新
      expect(pkg.devDependencies?.['@it/dep2']).toBe('1.1.0')
      expect(pkg.optionalDependencies?.['@it/dep3']).toBe('1.1.0')
      expect(safeWriteJson).toHaveBeenCalledWith(pkgJsonPath, pkg)
    })

    it('应该处理没有依赖的包', async () => {
      const pkgJsonPath = '/it/package.json'
      const pkg: PackageJson = {
        name: 'it-package',
        version: '1.0.0',
      }
      const version = '1.1.0'
      const pkgNames = ['@it/dep1']

      await updatePackageVersion(pkgJsonPath, pkg, version, pkgNames)

      expect(pkg.version).toBe('1.1.0')
      expect(safeWriteJson).toHaveBeenCalledWith(pkgJsonPath, pkg)
    })

    it('dry-run 应该只修改内存中的清单', async () => {
      const pkgJsonPath = '/it/package.json'
      const pkg: PackageJson = {
        name: 'it-package',
        version: '1.0.0',
      }

      await updatePackageVersion(pkgJsonPath, pkg, '1.1.0', undefined, {
        write: false,
      })

      expect(pkg.version).toBe('1.1.0')
      expect(safeWriteJson).not.toHaveBeenCalled()
    })
  })

  describe('updatePackageDependencies 函数', () => {
    it('应该更新 dependencies 中匹配的包版本', () => {
      const pkg: PackageJson = {
        name: 'it-package',
        version: '1.0.0',
        dependencies: {
          '@it/dep1': '1.0.0',
          '@it/dep2': '^1.0.0',
          'external-dep': '2.0.0',
        },
      }
      const version = '1.1.0'
      const pkgNames = ['@it/dep1', '@it/dep2']

      updatePackageDependencies(pkg, 'dependencies', version, pkgNames)

      expect(pkg.dependencies?.['@it/dep1']).toBe('1.1.0')
      expect(pkg.dependencies?.['@it/dep2']).toBe('1.1.0') // 正则会替换整个版本号，包括^
      expect(pkg.dependencies?.['external-dep']).toBe('2.0.0')
      expect(logger.info).toHaveBeenCalledWith(
        'it-package -> dependencies -> @it/dep1@1.1.0',
      )
      expect(logger.info).toHaveBeenCalledWith(
        'it-package -> dependencies -> @it/dep2@1.1.0',
      )
    })

    it('应该更新 devDependencies 中的版本', () => {
      const pkg: PackageJson = {
        name: 'it-package',
        version: '1.0.0',
        devDependencies: {
          '@it/dev-dep': '1.0.0-beta.1',
          jest: '^27.0.0',
        },
      }
      const version = '1.0.0-beta.2'
      const pkgNames = ['@it/dev-dep']

      updatePackageDependencies(pkg, 'devDependencies', version, pkgNames)

      expect(pkg.devDependencies?.['@it/dev-dep']).toBe('1.0.0-beta.2')
      expect(pkg.devDependencies?.['jest']).toBe('^27.0.0')
    })

    it('应该更新 peerDependencies 中的版本', () => {
      const pkg: PackageJson = {
        name: 'it-package',
        version: '1.0.0',
        peerDependencies: {
          '@it/peer-dep': '1.0.0',
          react: '^18.0.0',
        },
      }
      const version = '1.1.0'
      const pkgNames = ['@it/peer-dep']

      updatePackageDependencies(pkg, 'peerDependencies', version, pkgNames)

      expect(pkg.peerDependencies?.['@it/peer-dep']).toBe('1.1.0')
      expect(pkg.peerDependencies?.['react']).toBe('^18.0.0')
    })

    it('应该更新 optionalDependencies 中的版本', () => {
      const pkg: PackageJson = {
        name: 'it-package',
        version: '1.0.0',
        optionalDependencies: {
          '@it/optional-dep': '^1.0.0-canary.20260801-abc123',
        },
      }

      updatePackageDependencies(pkg, 'optionalDependencies', '1.1.0', [
        '@it/optional-dep',
      ])

      expect(pkg.optionalDependencies?.['@it/optional-dep']).toBe('1.1.0')
    })

    it('应该处理没有指定类型依赖的包', () => {
      const pkg: PackageJson = {
        name: 'it-package',
        version: '1.0.0',
      }
      const version = '1.1.0'
      const pkgNames = ['@it/dep']

      updatePackageDependencies(pkg, 'dependencies', version, pkgNames)

      // 应该没有错误，也没有更新任何东西
      expect(logger.info).not.toHaveBeenCalled()
    })

    it('应该正确处理复杂的版本号', () => {
      const pkg: PackageJson = {
        name: 'it-package',
        version: '1.0.0',
        dependencies: {
          '@it/alpha-dep': '1.0.0-alpha.1',
          '@it/beta-dep': '^2.1.0-beta.2',
          '@it/next-dep': '3.0.0-next.1',
        },
      }
      const version = '2.0.0-alpha.5'
      const pkgNames = ['@it/alpha-dep', '@it/beta-dep', '@it/next-dep']

      updatePackageDependencies(pkg, 'dependencies', version, pkgNames)

      expect(pkg.dependencies?.['@it/alpha-dep']).toBe('2.0.0-alpha.5')
      expect(pkg.dependencies?.['@it/beta-dep']).toBe('2.0.0-alpha.5') // 正则会替换整个版本号，包括^
      expect(pkg.dependencies?.['@it/next-dep']).toBe('2.0.0-alpha.5')
    })

    it('应该完整替换 rc、canary 和复合 SemVer 范围', () => {
      const pkg: PackageJson = {
        name: 'it-package',
        version: '1.0.0',
        dependencies: {
          '@it/rc-dep': '^1.0.0-rc.1',
          '@it/canary-dep': '~1.0.0-canary.20260801-abc123',
          '@it/range-dep': '^1.0.0 || ^2.0.0',
        },
      }
      const pkgNames = ['@it/rc-dep', '@it/canary-dep', '@it/range-dep']

      updatePackageDependencies(pkg, 'dependencies', '3.0.0', pkgNames)

      expect(pkg.dependencies?.['@it/rc-dep']).toBe('3.0.0')
      expect(pkg.dependencies?.['@it/canary-dep']).toBe('3.0.0')
      expect(pkg.dependencies?.['@it/range-dep']).toBe('3.0.0')
    })

    it('应该处理 workspace 协议', () => {
      const pkg: PackageJson = {
        name: 'it-package',
        version: '1.0.0',
        dependencies: {
          '@it/workspace-dep': 'workspace:^1.0.0',
          '@it/workspace-dep2': 'workspace:*',
        },
      }
      const version = '1.1.0'
      const pkgNames = ['@it/workspace-dep', '@it/workspace-dep2']

      updatePackageDependencies(pkg, 'dependencies', version, pkgNames)

      expect(pkg.dependencies?.['@it/workspace-dep']).toBe('workspace:1.1.0') // 正则也会影响workspace版本
      expect(pkg.dependencies?.['@it/workspace-dep2']).toBe('workspace:*') // 不应该被更新
    })

    it('应该保留不含固定版本的 workspace 范围', () => {
      const pkg: PackageJson = {
        name: 'it-package',
        version: '1.0.0',
        dependencies: {
          '@it/workspace-any': 'workspace:*',
          '@it/workspace-compatible': 'workspace:^',
          '@it/workspace-patch': 'workspace:~',
        },
      }
      const pkgNames = Object.keys(pkg.dependencies ?? {})

      updatePackageDependencies(pkg, 'dependencies', '1.1.0', pkgNames)

      expect(pkg.dependencies?.['@it/workspace-any']).toBe('workspace:*')
      expect(pkg.dependencies?.['@it/workspace-compatible']).toBe('workspace:^')
      expect(pkg.dependencies?.['@it/workspace-patch']).toBe('workspace:~')
    })

    it('应该对无效的 workspace 协议抛出错误', () => {
      const pkg: PackageJson = {
        name: 'it-package',
        version: '1.0.0',
        dependencies: {
          '@it/invalid-workspace': 'workspace: invalid',
        },
      }
      const version = '1.1.0'
      const pkgNames = ['@it/invalid-workspace']

      expect(() => {
        updatePackageDependencies(pkg, 'dependencies', version, pkgNames)
      }).toThrow(
        'Invalid workspace protocol `workspace: invalid` in `@it/invalid-workspace`.',
      )
    })

    it('应该只更新在 pkgNames 中的依赖', () => {
      const pkg: PackageJson = {
        name: 'it-package',
        version: '1.0.0',
        dependencies: {
          '@it/included': '1.0.0',
          '@it/excluded': '1.0.0',
          external: '1.0.0',
        },
      }
      const version = '1.1.0'
      const pkgNames = ['@it/included']

      updatePackageDependencies(pkg, 'dependencies', version, pkgNames)

      expect(pkg.dependencies?.['@it/included']).toBe('1.1.0')
      expect(pkg.dependencies?.['@it/excluded']).toBe('1.0.0')
      expect(pkg.dependencies?.['external']).toBe('1.0.0')
      expect(logger.info).toHaveBeenCalledTimes(1)
      expect(logger.info).toHaveBeenCalledWith(
        'it-package -> dependencies -> @it/included@1.1.0',
      )
    })
  })
})
