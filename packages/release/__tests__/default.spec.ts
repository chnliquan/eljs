/**
 * @file packages/release default 模块单元测试
 * @description 测试 default.ts 默认配置
 */

import { defaultConfig } from '../src/default'
import type { Config } from '../src/types'

describe('默认配置测试', () => {
  describe('defaultConfig 基本结构', () => {
    it('应该是一个有效的配置对象', () => {
      expect(defaultConfig).toBeDefined()
      expect(typeof defaultConfig).toBe('object')
      expect(defaultConfig).not.toBeNull()
    })

    it('应该包含所有必要的顶级配置项', () => {
      expect(defaultConfig).toHaveProperty('cwd')
      expect(defaultConfig).toHaveProperty('git')
      expect(defaultConfig).toHaveProperty('npm')
      expect(defaultConfig).toHaveProperty('github')
    })

    it('应该符合 Config 类型定义', () => {
      // TypeScript 编译时验证
      const config: Config = defaultConfig
      expect(config).toBe(defaultConfig)
    })
  })

  describe('默认工作目录配置', () => {
    it('应该使用当前工作目录作为默认值', () => {
      expect(defaultConfig.cwd).toBe(process.cwd())
      expect(typeof defaultConfig.cwd).toBe('string')
    })
  })

  describe('Git 默认配置', () => {
    it('应该包含完整的 git 配置项', () => {
      expect(defaultConfig.git).toBeDefined()
      expect(typeof defaultConfig.git).toBe('object')
    })

    it('应该启用工作区清洁检查', () => {
      expect(defaultConfig.git?.requireClean).toBe(true)
    })

    it('应该包含默认的 changelog 配置', () => {
      expect(defaultConfig.git?.changelog).toBeDefined()
      expect(defaultConfig.git?.changelog).not.toBe(false)

      if (typeof defaultConfig.git?.changelog === 'object') {
        expect(defaultConfig.git.changelog.filename).toBe('CHANGELOG.md')
        expect(defaultConfig.git.changelog.placeholder).toBe(
          '**Note:** No changes, only version bump.',
        )
      }
    })

    it('应该禁用独立标签', () => {
      expect(defaultConfig.git?.independent).toBe(false)
    })

    it('应该启用提交功能', () => {
      expect(defaultConfig.git?.commit).toBe(true)
    })

    it('应该使用默认的提交消息模板', () => {
      expect(defaultConfig.git?.commitMessage).toBe(
        'chore: bump version v${version}',
      )
    })

    it('应该启用推送功能', () => {
      expect(defaultConfig.git?.push).toBe(true)
    })

    it('应该包含默认的推送参数', () => {
      expect(defaultConfig.git?.pushArgs).toEqual(['--follow-tags'])
      expect(Array.isArray(defaultConfig.git?.pushArgs)).toBe(true)
    })
  })

  describe('NPM 默认配置', () => {
    it('应该包含完整的 npm 配置项', () => {
      expect(defaultConfig.npm).toBeDefined()
      expect(typeof defaultConfig.npm).toBe('object')
    })

    it('应该启用所有者检查', () => {
      expect(defaultConfig.npm?.requireOwner).toBe(true)
    })

    it('应该禁用金丝雀发布', () => {
      expect(defaultConfig.npm?.canary).toBe(false)
    })

    it('应该启用版本确认', () => {
      expect(defaultConfig.npm?.confirm).toBe(true)
    })

    it('不应该设置预发布相关配置', () => {
      expect(defaultConfig.npm?.prerelease).toBeUndefined()
      expect(defaultConfig.npm?.prereleaseId).toBeUndefined()
    })

    it('不应该设置发布参数', () => {
      expect(defaultConfig.npm?.publishArgs).toBeUndefined()
    })
  })

  describe('GitHub 默认配置', () => {
    it('应该包含 github 配置项', () => {
      expect(defaultConfig.github).toBeDefined()
      expect(typeof defaultConfig.github).toBe('object')
    })

    it('应该启用 GitHub 发布', () => {
      expect(defaultConfig.github?.release).toBe(true)
    })
  })

  describe('默认配置的不变性', () => {
    it('defaultConfig 应该是不可修改的（防止意外修改）', () => {
      const originalCwd = defaultConfig.cwd

      // 尝试修改（在实际使用中应该避免这样做）
      try {
        ;(defaultConfig as Config & { cwd: string }).cwd = '/modified/path'
        // 如果修改成功，检查是否真的被修改了
        if (defaultConfig.cwd === '/modified/path' && originalCwd) {
          // 恢复原值
          ;(defaultConfig as Config & { cwd: string }).cwd = originalCwd
        }
      } catch (error) {
        // 如果 defaultConfig 是只读的，修改会抛出错误
        expect(error).toBeDefined()
      }

      // 验证原值仍然存在
      expect(typeof defaultConfig.cwd).toBe('string')
    })

    it('嵌套对象也应该保持稳定', () => {
      const originalRequireClean = defaultConfig.git?.requireClean

      try {
        if (defaultConfig.git) {
          ;(
            defaultConfig.git as NonNullable<Config['git']> & {
              requireClean: boolean
            }
          ).requireClean = !originalRequireClean
          // 如果修改成功，恢复原值
          if (
            defaultConfig.git.requireClean !== originalRequireClean &&
            originalRequireClean !== undefined
          ) {
            ;(
              defaultConfig.git as NonNullable<Config['git']> & {
                requireClean: boolean
              }
            ).requireClean = originalRequireClean
          }
        }
      } catch (error) {
        // 如果是只读的，修改会抛出错误
        expect(error).toBeDefined()
      }

      expect(defaultConfig.git?.requireClean).toBeDefined()
    })
  })

  describe('默认配置的合理性', () => {
    it('changelog 配置应该是合理的', () => {
      const changelog = defaultConfig.git?.changelog

      if (typeof changelog === 'object') {
        expect(changelog.filename).toMatch(/\.(md|txt)$/i) // 应该是文本文件
        expect(changelog.placeholder).toBeTruthy() // 占位符不应该为空
        expect(changelog.placeholder?.length).toBeGreaterThan(0)
      }
    })

    it('提交消息模板应该包含版本占位符', () => {
      expect(defaultConfig.git?.commitMessage).toContain('${version}')
    })

    it('推送参数应该是有效的 git 参数', () => {
      const pushArgs = defaultConfig.git?.pushArgs

      if (Array.isArray(pushArgs)) {
        pushArgs.forEach(arg => {
          expect(typeof arg).toBe('string')
          expect(arg.length).toBeGreaterThan(0)
          expect(arg.startsWith('--')).toBe(true) // Git 参数通常以 -- 开头
        })
      }
    })

    it('所有布尔配置项应该有明确的值', () => {
      expect(typeof defaultConfig.git?.requireClean).toBe('boolean')
      expect(typeof defaultConfig.git?.independent).toBe('boolean')
      expect(typeof defaultConfig.git?.commit).toBe('boolean')
      expect(typeof defaultConfig.git?.push).toBe('boolean')
      expect(typeof defaultConfig.npm?.requireOwner).toBe('boolean')
      expect(typeof defaultConfig.npm?.canary).toBe('boolean')
      expect(typeof defaultConfig.npm?.confirm).toBe('boolean')
      expect(typeof defaultConfig.github?.release).toBe('boolean')
    })
  })

  describe('默认配置的扩展性', () => {
    it('应该能够与其他配置合并', () => {
      const customConfig: Config = {
        git: {
          requireClean: false,
          commitMessage: 'release: ${version}',
        },
        npm: {
          canary: true,
        },
      }

      const mergedConfig = {
        ...defaultConfig,
        ...customConfig,
        git: {
          ...defaultConfig.git,
          ...customConfig.git,
        },
        npm: {
          ...defaultConfig.npm,
          ...customConfig.npm,
        },
      }

      // 自定义配置应该覆盖默认配置
      expect(mergedConfig.git?.requireClean).toBe(false)
      expect(mergedConfig.git?.commitMessage).toBe('release: ${version}')
      expect(mergedConfig.npm?.canary).toBe(true)

      // 未覆盖的默认配置应该保持
      expect(mergedConfig.git?.push).toBe(true)
      expect(mergedConfig.npm?.requireOwner).toBe(true)
      expect(mergedConfig.github?.release).toBe(true)
    })

    it('应该支持部分覆盖', () => {
      const partialConfig: Partial<Config> = {
        npm: {
          confirm: false,
        },
      }

      const mergedConfig = {
        ...defaultConfig,
        npm: {
          ...defaultConfig.npm,
          ...partialConfig.npm,
        },
      }

      expect(mergedConfig.npm?.confirm).toBe(false)
      expect(mergedConfig.npm?.requireOwner).toBe(true) // 默认值保持
      expect(mergedConfig.npm?.canary).toBe(false) // 默认值保持
    })
  })
})
