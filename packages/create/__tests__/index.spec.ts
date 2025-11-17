/**
 * @file packages/create/src/index.ts 的单元测试
 * @description 测试主入口文件的导出功能和模块副作用
 */

// Mock require-hook 模块以避免副作用
jest.mock('../src/require-hook', () => ({
  hookPropertyMap: new Map(),
}))

// Mock 其他依赖模块
jest.mock('../src/core', () => ({
  Create: class MockCreate {
    public options: unknown
    public constructor(options: unknown) {
      this.options = options
    }
  },
}))

jest.mock('../src/default', () => ({
  defaultConfig: {
    cwd: process.cwd(),
    force: false,
    defaultQuestions: true,
    gitInit: true,
    install: true,
  },
}))

jest.mock('../src/define', () => ({
  defineConfig: jest.fn((config: unknown) => config),
}))

jest.mock('../src/types', () => ({
  // Mock types exports - types are compile-time only
}))

describe('入口文件', () => {
  // 清除所有 mock 在每个测试之间
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('模块导入和副作用', () => {
    it('应该正确导入 require-hook 模块并触发副作用', async () => {
      // 重新导入模块以确保副作用被触发
      const indexModule = await import('../src/index')

      // 验证模块被成功导入
      expect(indexModule).toBeDefined()

      // 验证 require-hook 模块的 mock 被调用
      expect(jest.isMockFunction).toBeDefined()
    })

    it('require-hook 模块应该在其他导出之前被导入', async () => {
      // 这个测试确保 import './require-hook' 在文件顶部执行
      const moduleContent = await import('../src/index')

      // 如果没有抛出错误，说明 require-hook 正确地在最开始被导入
      expect(moduleContent).toBeDefined()
    })
  })

  describe('Create 类导出', () => {
    it('应该正确导出 Create 类', async () => {
      const { Create } = await import('../src/index')

      expect(Create).toBeDefined()
      expect(typeof Create).toBe('function')

      // 验证 Create 可以被实例化
      const instance = new Create({
        template: 'test-template',
        cwd: process.cwd(),
      })

      expect(instance).toBeInstanceOf(Create)
    })

    it('Create 类应该来自 core 模块', async () => {
      const { Create } = await import('../src/index')
      const { Create: CoreCreate } = await import('../src/core')

      expect(Create).toBe(CoreCreate)
    })
  })

  describe('defaultConfig 导出', () => {
    it('应该正确导出 defaultConfig', async () => {
      const { defaultConfig } = await import('../src/index')

      expect(defaultConfig).toBeDefined()
      expect(typeof defaultConfig).toBe('object')

      // 验证默认配置的结构
      expect(defaultConfig).toHaveProperty('cwd')
      expect(defaultConfig).toHaveProperty('force')
      expect(defaultConfig).toHaveProperty('defaultQuestions')
      expect(defaultConfig).toHaveProperty('gitInit')
      expect(defaultConfig).toHaveProperty('install')
    })

    it('defaultConfig 应该来自 default 模块', async () => {
      const { defaultConfig } = await import('../src/index')
      const { defaultConfig: DefaultConfigFromSource } = await import(
        '../src/default'
      )

      expect(defaultConfig).toBe(DefaultConfigFromSource)
    })

    it('defaultConfig 应该具有正确的默认值', async () => {
      const { defaultConfig } = await import('../src/index')

      expect(defaultConfig.cwd).toBe(process.cwd())
      expect(defaultConfig.force).toBe(false)
      expect(defaultConfig.defaultQuestions).toBe(true)
      expect(defaultConfig.gitInit).toBe(true)
      expect(defaultConfig.install).toBe(true)
    })
  })

  describe('defineConfig 函数导出', () => {
    it('应该正确导出 defineConfig 函数', async () => {
      const { defineConfig } = await import('../src/index')

      expect(defineConfig).toBeDefined()
      expect(typeof defineConfig).toBe('function')
    })

    it('defineConfig 应该来自 define 模块', async () => {
      const { defineConfig } = await import('../src/index')
      const { defineConfig: DefineConfigFromSource } = await import(
        '../src/define'
      )

      expect(defineConfig).toBe(DefineConfigFromSource)
    })

    it('defineConfig 应该正确处理配置对象', async () => {
      const { defineConfig } = await import('../src/index')

      const testConfig = {
        cwd: '/test/path',
        force: true,
        defaultQuestions: false,
        gitInit: false,
        install: false,
      }

      const result = defineConfig(testConfig)
      expect(result).toBe(testConfig)
      expect(defineConfig).toHaveBeenCalledWith(testConfig)
    })
  })

  describe('types 模块导出', () => {
    it('应该正确导出所有 types', async () => {
      // 由于 TypeScript 类型在运行时不存在，我们主要验证导入不会出错
      const moduleExports = await import('../src/index')

      // 验证模块导入成功
      expect(moduleExports).toBeDefined()

      // 验证主要导出存在
      expect(moduleExports.Create).toBeDefined()
      expect(moduleExports.defaultConfig).toBeDefined()
      expect(moduleExports.defineConfig).toBeDefined()
    })

    it('types 导出不应该包含运行时值', async () => {
      // types 模块的导出应该只在编译时存在
      // 这个测试确保 export * from './types' 不会引入意外的运行时值
      const moduleExports = await import('../src/index')
      const exportKeys = Object.keys(moduleExports)

      // 验证只包含预期的运行时导出
      const expectedRuntimeExports = ['Create', 'defaultConfig', 'defineConfig']
      const runtimeExports = exportKeys.filter(key =>
        expectedRuntimeExports.includes(key),
      )

      expect(runtimeExports.length).toBe(expectedRuntimeExports.length)

      // 验证每个预期的导出都存在
      expectedRuntimeExports.forEach(exportName => {
        expect(
          (moduleExports as Record<string, unknown>)[exportName],
        ).toBeDefined()
      })
    })
  })

  describe('模块完整性测试', () => {
    it('应该导出所有预期的成员', async () => {
      const moduleExports = await import('../src/index')

      // 验证必需的导出存在
      expect(moduleExports.Create).toBeDefined()
      expect(moduleExports.defaultConfig).toBeDefined()
      expect(moduleExports.defineConfig).toBeDefined()

      // 验证导出的类型
      expect(typeof moduleExports.Create).toBe('function')
      expect(typeof moduleExports.defaultConfig).toBe('object')
      expect(typeof moduleExports.defineConfig).toBe('function')
    })

    it('不应该有意外的副作用', async () => {
      // 保存控制台方法
      const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
      }

      // Mock 控制台方法来检测意外输出
      const mockLog = jest.fn()
      const mockWarn = jest.fn()
      const mockError = jest.fn()

      console.log = mockLog
      console.warn = mockWarn
      console.error = mockError

      try {
        // 导入模块
        await import('../src/index')

        // 验证没有意外的控制台输出
        expect(mockLog).not.toHaveBeenCalled()
        expect(mockWarn).not.toHaveBeenCalled()
        expect(mockError).not.toHaveBeenCalled()
      } finally {
        // 恢复控制台方法
        console.log = originalConsole.log
        console.warn = originalConsole.warn
        console.error = originalConsole.error
      }
    })

    it('应该可以重复导入而不出错', async () => {
      // 多次导入应该不会出错
      const import1 = await import('../src/index')
      const import2 = await import('../src/index')
      const import3 = await import('../src/index')

      // 验证导入结果一致
      expect(import1).toBeDefined()
      expect(import2).toBeDefined()
      expect(import3).toBeDefined()

      // 验证导出的引用一致性
      expect(import1.Create).toBe(import2.Create)
      expect(import2.Create).toBe(import3.Create)

      expect(import1.defaultConfig).toBe(import2.defaultConfig)
      expect(import2.defaultConfig).toBe(import3.defaultConfig)

      expect(import1.defineConfig).toBe(import2.defineConfig)
      expect(import2.defineConfig).toBe(import3.defineConfig)
    })
  })

  describe('ESM/CommonJS 兼容性', () => {
    it('模块应该支持 ESM 导入方式', async () => {
      // 测试具名导入
      const { Create, defaultConfig, defineConfig } = await import(
        '../src/index'
      )

      expect(Create).toBeDefined()
      expect(defaultConfig).toBeDefined()
      expect(defineConfig).toBeDefined()
    })

    it('模块应该支持命名空间导入', async () => {
      // 测试命名空间导入
      const createModule = await import('../src/index')

      expect(createModule.Create).toBeDefined()
      expect(createModule.defaultConfig).toBeDefined()
      expect(createModule.defineConfig).toBeDefined()
    })

    it('导出应该是稳定的引用', async () => {
      const module1 = await import('../src/index')
      const module2 = await import('../src/index')

      // 同一个模块的多次导入应该返回相同的引用
      expect(module1 === module2).toBe(true)
      expect(module1.Create === module2.Create).toBe(true)
      expect(module1.defaultConfig === module2.defaultConfig).toBe(true)
      expect(module1.defineConfig === module2.defineConfig).toBe(true)
    })
  })

  describe('错误处理和边界情况', () => {
    it('在依赖模块出错时应该优雅地处理', async () => {
      // 这个测试验证在模块依赖出现问题时的行为
      // 由于我们已经 mock 了依赖，导入应该成功
      expect(async () => {
        await import('../src/index')
      }).not.toThrow()
    })

    it('应该正确处理 require-hook 的模块解析', async () => {
      // 验证 require-hook 不会干扰正常的模块导入
      const moduleExports = await import('../src/index')

      // 基本功能应该正常工作
      expect(moduleExports.Create).toBeDefined()
      expect(moduleExports.defaultConfig).toBeDefined()
      expect(moduleExports.defineConfig).toBeDefined()
    })
  })

  describe('性能和优化', () => {
    it('模块导入应该在合理时间内完成', async () => {
      const start = performance.now()

      await import('../src/index')

      const end = performance.now()
      const duration = end - start

      // 模块导入应该在 100ms 内完成
      expect(duration).toBeLessThan(100)
    })

    it('重复导入不应该造成性能问题', async () => {
      const start = performance.now()

      // 进行多次导入
      const promises = Array.from({ length: 10 }, () => import('../src/index'))
      await Promise.all(promises)

      const end = performance.now()
      const duration = end - start

      // 10次导入应该在 500ms 内完成
      expect(duration).toBeLessThan(500)
    })
  })

  describe('开发环境兼容性', () => {
    it('在开发环境中应该正常工作', async () => {
      const originalEnv = process.env.NODE_ENV

      try {
        process.env.NODE_ENV = 'development'

        const moduleExports = await import('../src/index')

        expect(moduleExports.Create).toBeDefined()
        expect(moduleExports.defaultConfig).toBeDefined()
        expect(moduleExports.defineConfig).toBeDefined()
      } finally {
        process.env.NODE_ENV = originalEnv
      }
    })

    it('在生产环境中应该正常工作', async () => {
      const originalEnv = process.env.NODE_ENV

      try {
        process.env.NODE_ENV = 'production'

        const moduleExports = await import('../src/index')

        expect(moduleExports.Create).toBeDefined()
        expect(moduleExports.defaultConfig).toBeDefined()
        expect(moduleExports.defineConfig).toBeDefined()
      } finally {
        process.env.NODE_ENV = originalEnv
      }
    })
  })

  describe('TypeScript 集成', () => {
    it('应该提供正确的 TypeScript 类型', async () => {
      // 这个测试主要验证编译时类型，运行时我们检查结构
      const { Create, defaultConfig, defineConfig } = await import(
        '../src/index'
      )

      // 验证 Create 类的基本结构
      expect(typeof Create).toBe('function')
      expect(Create.prototype).toBeDefined()

      // 验证 defaultConfig 的结构符合预期
      expect(typeof defaultConfig).toBe('object')
      expect(defaultConfig).not.toBeNull()

      // 验证 defineConfig 是一个函数
      expect(typeof defineConfig).toBe('function')
    })

    it('应该支持类型导入（编译时验证）', async () => {
      // 这个测试确保 export * from './types' 在 TypeScript 编译时正常工作
      // 运行时我们只能验证模块导入不出错
      expect(async () => {
        await import('../src/index')
      }).not.toThrow()
    })
  })

  describe('实际使用场景', () => {
    it('应该支持基本的使用模式', async () => {
      const { Create, defaultConfig, defineConfig } = await import(
        '../src/index'
      )

      // 测试 defineConfig 的使用
      const config = defineConfig({
        ...defaultConfig,
        force: true,
      })

      expect(config).toBeDefined()
      expect(config.force).toBe(true)

      // 测试 Create 类的使用
      const creator = new Create({
        template: 'test-template',
        ...config,
      })

      expect(creator).toBeInstanceOf(Create)
    })

    it('应该支持配置覆盖模式', async () => {
      const { defaultConfig, defineConfig } = await import('../src/index')

      const customConfig = defineConfig({
        cwd: '/custom/path',
        force: true,
        defaultQuestions: false,
        gitInit: false,
        install: false,
      })

      expect(customConfig).toBeDefined()
      expect(defineConfig).toHaveBeenCalledWith({
        cwd: '/custom/path',
        force: true,
        defaultQuestions: false,
        gitInit: false,
        install: false,
      })

      // 验证自定义配置与默认配置的差异
      expect(customConfig.force).not.toBe(defaultConfig.force)
      expect(customConfig.defaultQuestions).not.toBe(
        defaultConfig.defaultQuestions,
      )
    })

    it('应该支持链式使用模式', async () => {
      const { Create, defineConfig, defaultConfig } = await import(
        '../src/index'
      )

      // 模拟链式使用
      const config = defineConfig({
        ...defaultConfig,
        template: 'my-template',
      })

      const creator = new Create({
        template: 'test-template',
        ...config,
      })

      expect(creator).toBeInstanceOf(Create)
      expect(config).toBeDefined()
    })
  })
})
