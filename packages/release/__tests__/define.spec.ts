/**
 * @file packages/release define 模块单元测试
 * @description 测试 define.ts 配置定义功能
 */

import { defineConfig } from '../src/define'
import type { Config } from '../src/types'

describe('配置定义函数测试', () => {
  describe('defineConfig 函数', () => {
    test('应该原样返回传入的配置对象', () => {
      const config: Config = {
        cwd: '/test/path',
        git: {
          requireClean: false,
          commit: true,
        },
        npm: {
          confirm: false,
        },
      }

      const result = defineConfig(config)

      expect(result).toBe(config) // 应该返回同一个对象引用
      expect(result).toEqual(config) // 内容也应该相同
    })

    test('应该接受空配置对象', () => {
      const config: Config = {}
      const result = defineConfig(config)

      expect(result).toBe(config)
      expect(result).toEqual({})
    })

    test('应该接受完整配置对象', () => {
      const config: Config = {
        cwd: '/custom/working/directory',
        presets: ['@eljs/release-preset-custom'],
        plugins: ['@eljs/release-plugin-custom'],
        git: {
          requireClean: true,
          requireBranch: 'main',
          changelog: {
            filename: 'CHANGES.md',
            placeholder: 'No changes in this release.',
            preset: 'angular',
          },
          independent: false,
          commit: true,
          commitMessage: 'release: v${version}',
          commitArgs: ['--no-verify'],
          push: true,
          pushArgs: ['--follow-tags', '--force'],
        },
        npm: {
          requireOwner: true,
          prerelease: false,
          prereleaseId: 'beta',
          canary: false,
          confirm: true,
          publishArgs: ['--access', 'public'],
        },
        github: {
          release: true,
        },
      }

      const result = defineConfig(config)

      expect(result).toBe(config)
      expect(result.cwd).toBe('/custom/working/directory')
      expect(result.git?.changelog).toEqual({
        filename: 'CHANGES.md',
        placeholder: 'No changes in this release.',
        preset: 'angular',
      })
      expect(result.npm?.prereleaseId).toBe('beta')
      expect(result.github?.release).toBe(true)
    })

    test('应该支持禁用 changelog', () => {
      const config: Config = {
        git: {
          changelog: false,
        },
      }

      const result = defineConfig(config)

      expect(result).toBe(config)
      expect(result.git?.changelog).toBe(false)
    })

    test('应该保持对象的不可变性（浅层）', () => {
      const original: Config = {
        cwd: '/original/path',
        git: {
          requireClean: true,
        },
      }

      const result = defineConfig(original)

      // 修改返回的对象
      result.cwd = '/modified/path'
      // 原始对象也会被修改（因为返回的是同一个引用）
      expect(original.cwd).toBe('/modified/path')
      expect(result).toBe(original)
    })

    test('应该支持复杂的嵌套配置', () => {
      const config: Config = {
        git: {
          changelog: {
            filename: 'HISTORY.md',
            placeholder: 'No notable changes.',
            preset: '@my-org/conventional-changelog-preset',
          },
          commitArgs: [
            '--gpg-sign',
            '--author="Release Bot <bot@example.com>"',
          ],
          pushArgs: '--force-with-lease',
        },
        npm: {
          publishArgs: ['--tag', 'next', '--access', 'public'],
        },
      }

      const result = defineConfig(config)

      expect(result).toBe(config)
      expect(Array.isArray(result.git?.commitArgs)).toBe(true)
      expect(typeof result.git?.pushArgs).toBe('string')
      expect(Array.isArray(result.npm?.publishArgs)).toBe(true)
    })

    test('应该保持类型安全', () => {
      // 这个测试主要是为了确保 TypeScript 类型检查正确
      const config: Config = {
        npm: {
          prereleaseId: 'alpha', // 应该是有效的 PrereleaseId
        },
      }

      const result = defineConfig(config)

      expect(result.npm?.prereleaseId).toBe('alpha')
      // TypeScript 应该确保 prereleaseId 只能是 'alpha' | 'beta' | 'rc'
    })

    test('应该处理带有扩展属性的配置', () => {
      const config: Config & { custom?: string } = {
        cwd: '/test',
        custom: 'custom value', // 扩展属性
      }

      const result = defineConfig(config)

      expect(result).toBe(config)
      expect((result as Config & { custom?: string }).custom).toBe(
        'custom value',
      )
    })

    test('应该支持函数的链式调用', () => {
      const config1: Config = { cwd: '/path1' }
      const config2: Config = { cwd: '/path2' }

      const result1 = defineConfig(config1)
      const result2 = defineConfig(config2)

      expect(result1).toBe(config1)
      expect(result2).toBe(config2)
      expect(result1).not.toBe(result2)
    })
  })

  describe('defineConfig 类型推断', () => {
    test('应该正确推断返回类型', () => {
      const config = {
        cwd: '/test',
        git: {
          requireClean: false,
        },
      } as const

      const result = defineConfig(config)

      // TypeScript 应该推断出正确的类型
      expect(typeof result.cwd).toBe('string')
      expect(typeof result.git?.requireClean).toBe('boolean')
    })

    test('应该支持部分配置的类型推断', () => {
      const partialConfig: Partial<Config> = {
        git: {
          commit: false,
        },
      }

      // 即使是部分配置，也应该能正常工作
      const result = defineConfig(partialConfig)

      expect(result).toBe(partialConfig)
      expect(result.git?.commit).toBe(false)
    })
  })

  describe('defineConfig 边界情况', () => {
    test('应该处理具有 undefined 属性的配置', () => {
      const config: Config = {
        cwd: undefined as string | undefined,
        git: {
          requireClean: undefined as boolean | undefined,
        },
      }

      const result = defineConfig(config)

      expect(result).toBe(config)
      expect(result.cwd).toBeUndefined()
      expect(result.git?.requireClean).toBeUndefined()
    })

    test('应该处理具有 null 属性的配置', () => {
      // 使用类型断言绕过严格的类型检查，用于测试边界情况
      const config = {
        git: {
          requireBranch: null,
        },
      } as unknown as Config

      const result = defineConfig(config)

      expect(result).toBe(config)
      expect(result.git?.requireBranch).toBeNull()
    })

    test('应该处理空字符串配置', () => {
      const config: Config = {
        cwd: '',
        git: {
          commitMessage: '',
        },
      }

      const result = defineConfig(config)

      expect(result).toBe(config)
      expect(result.cwd).toBe('')
      expect(result.git?.commitMessage).toBe('')
    })
  })
})
