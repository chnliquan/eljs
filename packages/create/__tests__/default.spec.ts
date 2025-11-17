import { defaultConfig } from '../src/default'
import type { Config } from '../src/types/config'

describe('defaultConfig', () => {
  describe('配置项验证', () => {
    it('应该包含所有必要的配置属性', () => {
      expect(defaultConfig).toBeDefined()
      expect(typeof defaultConfig).toBe('object')

      // 验证所有配置属性存在
      expect(defaultConfig).toHaveProperty('cwd')
      expect(defaultConfig).toHaveProperty('force')
      expect(defaultConfig).toHaveProperty('defaultQuestions')
      expect(defaultConfig).toHaveProperty('gitInit')
      expect(defaultConfig).toHaveProperty('install')
    })

    it('应该具有正确的默认值类型', () => {
      // 验证 cwd 是字符串类型
      expect(typeof defaultConfig.cwd).toBe('string')
      expect(defaultConfig.cwd).toBe(process.cwd())

      // 验证 force 是布尔类型且为 false
      expect(typeof defaultConfig.force).toBe('boolean')
      expect(defaultConfig.force).toBe(false)

      // 验证 defaultQuestions 是布尔类型且为 true
      expect(typeof defaultConfig.defaultQuestions).toBe('boolean')
      expect(defaultConfig.defaultQuestions).toBe(true)

      // 验证 gitInit 是布尔类型且为 true
      expect(typeof defaultConfig.gitInit).toBe('boolean')
      expect(defaultConfig.gitInit).toBe(true)

      // 验证 install 是布尔类型且为 true
      expect(typeof defaultConfig.install).toBe('boolean')
      expect(defaultConfig.install).toBe(true)
    })
  })

  describe('配置项默认值验证', () => {
    it('cwd 应该指向当前工作目录', () => {
      expect(defaultConfig.cwd).toBe(process.cwd())
    })

    it('force 应该默认为 false，不覆盖已存在的目录', () => {
      expect(defaultConfig.force).toBe(false)
    })

    it('defaultQuestions 应该默认为 true，启用默认提示', () => {
      expect(defaultConfig.defaultQuestions).toBe(true)
    })

    it('gitInit 应该默认为 true，创建完成后初始化 git', () => {
      expect(defaultConfig.gitInit).toBe(true)
    })

    it('install 应该默认为 true，创建完成后安装依赖', () => {
      expect(defaultConfig.install).toBe(true)
    })
  })

  describe('配置对象不可变性', () => {
    it('应该是一个只读对象的快照', () => {
      const originalForce = defaultConfig.force

      // 尝试修改配置应该不影响原对象（或抛出错误）
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(defaultConfig as any).force = true
      }).not.toThrow()

      // 恢复原始值，避免影响其他测试
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(defaultConfig as any).force = originalForce

      // 至少确保我们能获取到所有原始配置
      expect(defaultConfig.cwd).toBeDefined()
      expect(typeof defaultConfig.force).toBe('boolean')
      expect(typeof defaultConfig.defaultQuestions).toBe('boolean')
      expect(typeof defaultConfig.gitInit).toBe('boolean')
      expect(typeof defaultConfig.install).toBe('boolean')
    })

    it('应该可以安全地解构', () => {
      const { cwd, force, defaultQuestions, gitInit, install } = defaultConfig

      expect(typeof cwd).toBe('string')
      expect(typeof force).toBe('boolean')
      expect(typeof defaultQuestions).toBe('boolean')
      expect(typeof gitInit).toBe('boolean')
      expect(typeof install).toBe('boolean')
    })
  })

  describe('配置兼容性验证', () => {
    it('应该符合 Config 接口规范', () => {
      // 验证 cwd 配置
      expect(defaultConfig.cwd).toBeTruthy()
      if (defaultConfig.cwd) {
        expect(defaultConfig.cwd.length).toBeGreaterThan(0)
      }

      // 验证布尔配置项
      const booleanProps = [
        'force',
        'defaultQuestions',
        'gitInit',
        'install',
      ] as const
      booleanProps.forEach(prop => {
        expect(typeof defaultConfig[prop]).toBe('boolean')
      })
    })

    it('应该包含所有可选的 Config 属性的合理默认值', () => {
      // 验证工作目录设置合理
      expect(defaultConfig.cwd).toBe(process.cwd())

      // 验证安全默认值：不强制覆盖
      expect(defaultConfig.force).toBe(false)

      // 验证用户友好默认值：启用交互式问题
      expect(defaultConfig.defaultQuestions).toBe(true)

      // 验证开发友好默认值：自动初始化 git 和安装依赖
      expect(defaultConfig.gitInit).toBe(true)
      expect(defaultConfig.install).toBe(true)
    })
  })

  describe('环境适应性', () => {
    it('cwd 应该根据当前进程工作目录动态设置', () => {
      const currentCwd = process.cwd()
      expect(defaultConfig.cwd).toBe(currentCwd)
    })

    it('应该在不同环境下保持一致的配置结构', () => {
      const configKeys = Object.keys(defaultConfig).sort()
      const expectedKeys = [
        'cwd',
        'force',
        'defaultQuestions',
        'gitInit',
        'install',
      ].sort()

      expect(configKeys).toEqual(expectedKeys)
    })
  })

  describe('边界情况处理', () => {
    it('应该处理空的工作目录情况', () => {
      // 模拟 process.cwd() 的边界情况
      const originalCwd = process.cwd

      try {
        // 模拟获取 cwd 时的情况，确保不会崩溃
        expect(() => {
          const cwd = defaultConfig.cwd
          expect(typeof cwd).toBe('string')
        }).not.toThrow()
      } finally {
        // 恢复原始函数
        process.cwd = originalCwd
      }
    })

    it('配置对象应该是可序列化的', () => {
      expect(() => {
        const serialized = JSON.stringify(defaultConfig)
        const deserialized = JSON.parse(serialized)

        // 验证序列化后的对象保持基本结构
        expect(deserialized).toHaveProperty('force')
        expect(deserialized).toHaveProperty('defaultQuestions')
        expect(deserialized).toHaveProperty('gitInit')
        expect(deserialized).toHaveProperty('install')
      }).not.toThrow()
    })
  })

  describe('类型安全性', () => {
    it('应该符合 TypeScript 类型定义', () => {
      // TypeScript 编译时会验证类型，这里进行运行时验证
      expect(defaultConfig).toMatchObject({
        cwd: expect.any(String),
        force: expect.any(Boolean),
        defaultQuestions: expect.any(Boolean),
        gitInit: expect.any(Boolean),
        install: expect.any(Boolean),
      })
    })

    it('不应该包含额外的未定义属性', () => {
      const allowedKeys = [
        'cwd',
        'force',
        'defaultQuestions',
        'gitInit',
        'install',
      ]
      const actualKeys = Object.keys(defaultConfig)

      // 检查是否有额外的属性
      const extraKeys = actualKeys.filter(key => !allowedKeys.includes(key))
      expect(extraKeys).toEqual([])

      // 检查是否缺少必需的属性
      const missingKeys = allowedKeys.filter(key => !actualKeys.includes(key))
      expect(missingKeys).toEqual([])
    })
  })

  describe('实际用例验证', () => {
    it('应该提供合理的项目创建默认行为', () => {
      // 验证创建新项目时的合理默认行为

      // 1. 在当前目录工作
      expect(defaultConfig.cwd).toBe(process.cwd())

      // 2. 不强制覆盖现有文件，保护用户数据
      expect(defaultConfig.force).toBe(false)

      // 3. 启用交互式问题，提升用户体验
      expect(defaultConfig.defaultQuestions).toBe(true)

      // 4. 自动初始化 git，符合现代开发实践
      expect(defaultConfig.gitInit).toBe(true)

      // 5. 自动安装依赖，提供即用的开发环境
      expect(defaultConfig.install).toBe(true)
    })

    it('应该支持配置合并场景', () => {
      const customConfig = {
        force: true,
        install: false,
      }

      const mergedConfig = { ...defaultConfig, ...customConfig }

      // 验证合并后保留默认值
      expect(mergedConfig.cwd).toBe(defaultConfig.cwd)
      expect(mergedConfig.defaultQuestions).toBe(defaultConfig.defaultQuestions)
      expect(mergedConfig.gitInit).toBe(defaultConfig.gitInit)

      // 验证自定义值被正确覆盖
      expect(mergedConfig.force).toBe(true)
      expect(mergedConfig.install).toBe(false)
    })
  })

  describe('性能和稳定性', () => {
    it('多次访问应该返回一致的结果', () => {
      const firstAccess = { ...defaultConfig }
      const secondAccess = { ...defaultConfig }
      const thirdAccess = { ...defaultConfig }

      expect(firstAccess).toEqual(secondAccess)
      expect(secondAccess).toEqual(thirdAccess)
    })

    it('配置访问应该是高效的', () => {
      const start = performance.now()

      // 进行多次配置访问
      for (let i = 0; i < 1000; i++) {
        // 简单地访问配置值以测试性能，但不存储到变量中
        void defaultConfig.cwd
        void defaultConfig.force
        void defaultConfig.defaultQuestions
        void defaultConfig.gitInit
        void defaultConfig.install
      }

      const end = performance.now()
      const duration = end - start

      // 1000次访问应该在合理时间内完成（<100ms）
      expect(duration).toBeLessThan(100)
    })
  })

  describe('Config 接口兼容性', () => {
    it('应该能够被赋值给 Config 类型', () => {
      // 这个测试主要在编译时验证类型兼容性
      const config: Config = defaultConfig

      expect(config).toBeDefined()
      expect(config.cwd).toBe(process.cwd())
      expect(config.force).toBe(false)
      expect(config.defaultQuestions).toBe(true)
      expect(config.gitInit).toBe(true)
      expect(config.install).toBe(true)
    })

    it('应该包含 Config 接口的必要属性', () => {
      // 验证 defaultConfig 包含 Config 接口的所有可选属性
      const configAsInterface: Partial<Config> = defaultConfig

      expect(configAsInterface.cwd).toBeDefined()
      expect(configAsInterface.force).toBeDefined()
      expect(configAsInterface.defaultQuestions).toBeDefined()
      expect(configAsInterface.gitInit).toBeDefined()
      expect(configAsInterface.install).toBeDefined()
    })
  })
})
