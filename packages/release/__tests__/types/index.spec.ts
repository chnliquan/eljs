/**
 * @file packages/release types 模块单元测试
 * @description 测试 types 目录下的类型定义
 */

import type { PackageJson } from '@eljs/utils'

import type {
  Api,
  AppData,
  Config,
  DistTag,
  PrereleaseId,
} from '../../src/types'

describe('类型定义测试', () => {
  describe('PrereleaseId 类型', () => {
    test('应该接受有效的预发布标识符', () => {
      const validIds: PrereleaseId[] = ['alpha', 'beta', 'rc']

      validIds.forEach(id => {
        expect(['alpha', 'beta', 'rc']).toContain(id)
      })
    })

    test('PrereleaseId 应该是字符串字面量类型', () => {
      // TypeScript 编译时验证
      const alpha: PrereleaseId = 'alpha'
      const beta: PrereleaseId = 'beta'
      const rc: PrereleaseId = 'rc'

      expect(typeof alpha).toBe('string')
      expect(typeof beta).toBe('string')
      expect(typeof rc).toBe('string')
    })
  })

  describe('DistTag 类型', () => {
    test('应该接受所有有效的 dist tag', () => {
      const validTags: DistTag[] = ['latest', 'alpha', 'beta', 'rc']

      validTags.forEach(tag => {
        expect(['latest', 'alpha', 'beta', 'rc']).toContain(tag)
      })
    })

    test('DistTag 应该包含 PrereleaseId 和 latest', () => {
      const latest: DistTag = 'latest'
      const alpha: DistTag = 'alpha'
      const beta: DistTag = 'beta'
      const rc: DistTag = 'rc'

      expect(typeof latest).toBe('string')
      expect(typeof alpha).toBe('string')
      expect(typeof beta).toBe('string')
      expect(typeof rc).toBe('string')
    })
  })

  describe('Config 类型', () => {
    test('应该允许空配置对象', () => {
      const config: Config = {}
      expect(typeof config).toBe('object')
    })

    test('应该允许部分配置', () => {
      const config: Config = {
        cwd: '/test/path',
        git: {
          requireClean: false,
        },
      }

      expect(config.cwd).toBe('/test/path')
      expect(config.git?.requireClean).toBe(false)
    })

    test('应该允许完整的 git 配置', () => {
      const config: Config = {
        git: {
          requireClean: true,
          requireBranch: 'main',
          changelog: {
            filename: 'CHANGELOG.md',
            placeholder: 'No changes',
            preset: 'angular',
          },
          independent: false,
          commit: true,
          commitMessage: 'chore: release v${version}',
          commitArgs: ['--no-verify'],
          push: true,
          pushArgs: ['--follow-tags'],
        },
      }

      expect(config.git?.requireClean).toBe(true)
      expect(config.git?.changelog).toBeDefined()
      expect(config.git?.changelog).not.toBe(false)
    })

    test('应该允许禁用 changelog', () => {
      const config: Config = {
        git: {
          changelog: false,
        },
      }

      expect(config.git?.changelog).toBe(false)
    })

    test('应该允许完整的 npm 配置', () => {
      const config: Config = {
        npm: {
          requireOwner: true,
          prerelease: true,
          prereleaseId: 'beta',
          canary: false,
          confirm: true,
          publishArgs: ['--tag', 'beta'],
        },
      }

      expect(config.npm?.prereleaseId).toBe('beta')
      expect(config.npm?.publishArgs).toEqual(['--tag', 'beta'])
    })

    test('应该允许 github 配置', () => {
      const config: Config = {
        github: {
          release: true,
        },
      }

      expect(config.github?.release).toBe(true)
    })

    test('应该支持字符串或数组类型的参数', () => {
      const configWithString: Config = {
        git: {
          commitArgs: '--no-verify',
          pushArgs: '--force',
        },
        npm: {
          publishArgs: '--tag beta',
        },
      }

      const configWithArray: Config = {
        git: {
          commitArgs: ['--no-verify', '--author="Bot <bot@example.com>"'],
          pushArgs: ['--force', '--follow-tags'],
        },
        npm: {
          publishArgs: ['--tag', 'beta'],
        },
      }

      expect(typeof configWithString.git?.commitArgs).toBe('string')
      expect(Array.isArray(configWithArray.git?.commitArgs)).toBe(true)
    })
  })

  describe('AppData 类型', () => {
    test('应该包含所有必需的字段', () => {
      // 创建一个简化的 PackageJson 对象用于测试
      const mockPackageJson = {
        name: 'test-project',
        version: '1.0.0',
        description: 'Test project',
        main: 'index.js',
        scripts: {},
        keywords: [],
        author: 'Test Author',
        license: 'MIT',
      } as PackageJson

      const appData: Partial<AppData> = {
        cliVersion: '1.0.0',
        registry: 'https://registry.npmjs.org',
        branch: 'main',
        latestTag: 'v1.0.0',
        projectPkgJsonPath: '/project/package.json',
        projectPkg: mockPackageJson as Required<PackageJson>,
        pkgJsonPaths: ['/project/package.json'],
        pkgs: [mockPackageJson as Required<PackageJson>],
        pkgNames: ['test-project'],
        validPkgRootPaths: ['/project'],
        validPkgNames: ['test-project'],
        packageManager: 'pnpm',
      }

      expect(appData.cliVersion).toBe('1.0.0')
      expect(appData.packageManager).toBe('pnpm')
      expect(Array.isArray(appData.pkgNames)).toBe(true)
      expect(Array.isArray(appData.validPkgNames)).toBe(true)
    })

    test('应该允许 latestTag 为 null', () => {
      const appData: Partial<AppData> = {
        latestTag: null,
      }

      expect(appData.latestTag).toBeNull()
    })

    test('应该支持扩展字段', () => {
      const appData: AppData & { customField?: string } = {
        cliVersion: '1.0.0',
        registry: 'https://registry.npmjs.org',
        branch: 'main',
        latestTag: null,
        projectPkgJsonPath: '/project/package.json',
        projectPkg: {} as Required<PackageJson>,
        pkgJsonPaths: [],
        pkgs: [],
        pkgNames: [],
        validPkgRootPaths: [],
        validPkgNames: [],
        packageManager: 'npm',
        // 扩展字段
        customField: 'custom value',
      }

      expect(appData.customField).toBe('custom value')
    })

    test('应该支持不同的包管理器', () => {
      const npmData: Partial<AppData> = { packageManager: 'npm' }
      const yarnData: Partial<AppData> = { packageManager: 'yarn' }
      const pnpmData: Partial<AppData> = { packageManager: 'pnpm' }
      const bunData: Partial<AppData> = { packageManager: 'bun' }

      expect(npmData.packageManager).toBe('npm')
      expect(yarnData.packageManager).toBe('yarn')
      expect(pnpmData.packageManager).toBe('pnpm')
      expect(bunData.packageManager).toBe('bun')
    })
  })

  describe('Api 类型', () => {
    test('Api 类型应该从多个接口继承', () => {
      // 这个测试主要验证类型定义的正确性
      // 在实际使用中，Api 类型会包含多个接口的属性
      const mockApi: Partial<Api> = {
        // 来自各个接口的属性
      }

      expect(typeof mockApi).toBe('object')
    })
  })

  describe('类型兼容性测试', () => {
    test('PrereleaseId 应该兼容 DistTag', () => {
      const prereleaseId: PrereleaseId = 'alpha'
      const distTag: DistTag = prereleaseId // 应该可以赋值

      expect(distTag).toBe('alpha')
    })

    test('Config 应该支持嵌套的可选属性', () => {
      const config: Config = {
        git: {
          changelog: {
            filename: 'CHANGES.md',
          },
        },
      }

      // 即使只设置了部分属性，也应该是有效的
      expect(config.git?.changelog).toBeDefined()
      expect(config.git?.changelog).not.toBe(false)
    })

    test('应该支持类型推断', () => {
      // TypeScript 应该能够推断出正确的类型
      const config = {
        cwd: '/test',
        git: {
          requireClean: false,
        },
      } satisfies Config

      expect(config.cwd).toBe('/test')
      expect(config.git?.requireClean).toBe(false)
    })
  })

  describe('类型约束测试', () => {
    test('Config 应该继承自 UserConfig', () => {
      // Config 接口扩展了 UserConfig，所以应该包含相关属性
      const config: Config = {
        cwd: '/test',
        // UserConfig 的属性也应该可用
      }

      expect(typeof config).toBe('object')
    })

    test('AppData 应该包含必需和可选的字段', () => {
      const minimalAppData: Partial<AppData> = {
        cliVersion: '1.0.0',
        registry: '',
        branch: '',
        latestTag: null,
        projectPkgJsonPath: '',
        projectPkg: {} as Required<PackageJson>,
        pkgJsonPaths: [],
        pkgs: [],
        pkgNames: [],
        validPkgRootPaths: [],
        validPkgNames: [],
        packageManager: 'npm',
      }

      expect(Array.isArray(minimalAppData.pkgNames)).toBe(true)
      expect(minimalAppData.latestTag).toBeNull()
    })
  })

  describe('类型导出验证', () => {
    test('所有类型都应该能够正确导入', () => {
      // 通过能够声明这些类型变量来验证导入成功
      const prereleaseId: PrereleaseId = 'alpha'
      const distTag: DistTag = 'latest'
      const config: Config = {}

      expect(typeof prereleaseId).toBe('string')
      expect(typeof distTag).toBe('string')
      expect(typeof config).toBe('object')
    })

    test('类型定义应该是稳定的', () => {
      // 验证类型的基本特性
      const types = {
        PrereleaseId: ['alpha', 'beta', 'rc'],
        DistTag: ['latest', 'alpha', 'beta', 'rc'],
      }

      expect(types.PrereleaseId).toHaveLength(3)
      expect(types.DistTag).toHaveLength(4)
    })
  })
})
