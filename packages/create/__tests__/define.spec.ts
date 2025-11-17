import { defineConfig } from '../src/define'
import type { Config } from '../src/types'

describe('defineConfig', () => {
  describe('基本功能', () => {
    it('应该返回传入的配置对象', () => {
      const config: Config = {
        cwd: '/test/path',
        force: true,
      }

      const result = defineConfig(config)

      expect(result).toBe(config)
      expect(result).toEqual(config)
    })

    it('应该是一个函数', () => {
      expect(typeof defineConfig).toBe('function')
      expect(defineConfig).toBeInstanceOf(Function)
    })

    it('应该接受任意 Config 参数', () => {
      const emptyConfig: Config = {}
      const fullConfig: Config = {
        cwd: process.cwd(),
        template: 'test-template',
        force: true,
        merge: false,
        defaultQuestions: true,
        gitInit: false,
        install: true,
      }

      expect(() => defineConfig(emptyConfig)).not.toThrow()
      expect(() => defineConfig(fullConfig)).not.toThrow()

      expect(defineConfig(emptyConfig)).toBe(emptyConfig)
      expect(defineConfig(fullConfig)).toBe(fullConfig)
    })
  })

  describe('类型安全性', () => {
    it('应该保持输入对象的类型和属性', () => {
      const config: Config = {
        cwd: '/custom/path',
        template: 'vue',
        force: false,
        merge: true,
        defaultQuestions: false,
        gitInit: true,
        install: false,
      }

      const result = defineConfig(config)

      expect(result.cwd).toBe('/custom/path')
      expect(result.template).toBe('vue')
      expect(result.force).toBe(false)
      expect(result.merge).toBe(true)
      expect(result.defaultQuestions).toBe(false)
      expect(result.gitInit).toBe(true)
      expect(result.install).toBe(false)
    })

    it('应该正确处理 string 类型的 template', () => {
      const config: Config = {
        template: 'react-template',
      }

      const result = defineConfig(config)

      expect(result.template).toBe('react-template')
      expect(typeof result.template).toBe('string')
    })

    it('应该正确处理 RemoteTemplate 类型的 template', () => {
      const config: Config = {
        template: {
          type: 'npm',
          value: '@my/template',
          registry: 'https://registry.npmjs.org',
        },
      }

      const result = defineConfig(config)

      expect(result.template).toEqual({
        type: 'npm',
        value: '@my/template',
        registry: 'https://registry.npmjs.org',
      })
      expect(typeof result.template).toBe('object')

      if (typeof result.template === 'object' && result.template !== null) {
        expect(result.template.type).toBe('npm')
        expect(result.template.value).toBe('@my/template')
        expect(result.template.registry).toBe('https://registry.npmjs.org')
      }
    })

    it('应该支持 git 类型的 RemoteTemplate', () => {
      const config: Config = {
        template: {
          type: 'git',
          value: 'https://github.com/user/template.git',
        },
      }

      const result = defineConfig(config)

      expect(result.template).toEqual({
        type: 'git',
        value: 'https://github.com/user/template.git',
      })

      if (typeof result.template === 'object' && result.template !== null) {
        expect(result.template.type).toBe('git')
        expect(result.template.value).toBe(
          'https://github.com/user/template.git',
        )
        expect(result.template.registry).toBeUndefined()
      }
    })
  })

  describe('边界情况', () => {
    it('应该正确处理空配置对象', () => {
      const emptyConfig: Config = {}
      const result = defineConfig(emptyConfig)

      expect(result).toEqual({})
      expect(result).toBe(emptyConfig)
      expect(Object.keys(result)).toHaveLength(0)
    })

    it('应该保持对象引用相同', () => {
      const config: Config = { cwd: '/test' }
      const result = defineConfig(config)

      expect(result).toBe(config)
      expect(Object.is(result, config)).toBe(true)
    })

    it('应该处理包含所有可选属性的完整配置', () => {
      const fullConfig: Config = {
        cwd: '/full/path',
        template: {
          type: 'npm',
          value: '@scope/template',
          registry: 'https://custom-registry.com',
        },
        force: true,
        merge: false,
        defaultQuestions: true,
        gitInit: false,
        install: true,
      }

      const result = defineConfig(fullConfig)

      expect(result).toBe(fullConfig)
      expect(result).toMatchObject(fullConfig)
    })

    it('应该处理部分配置属性', () => {
      const partialConfig: Config = {
        force: true,
        gitInit: false,
      }

      const result = defineConfig(partialConfig)

      expect(result).toBe(partialConfig)
      expect(result.force).toBe(true)
      expect(result.gitInit).toBe(false)
      expect(result.cwd).toBeUndefined()
      expect(result.template).toBeUndefined()
      expect(result.merge).toBeUndefined()
      expect(result.defaultQuestions).toBeUndefined()
      expect(result.install).toBeUndefined()
    })
  })

  describe('配置验证', () => {
    it('应该接受有效的 cwd 路径', () => {
      const validPaths = [
        '/absolute/path',
        './relative/path',
        '../parent/path',
        process.cwd(),
        '/',
        'simple-path',
      ]

      validPaths.forEach(path => {
        const config: Config = { cwd: path }
        const result = defineConfig(config)

        expect(result.cwd).toBe(path)
        expect(() => defineConfig(config)).not.toThrow()
      })
    })

    it('应该正确处理布尔值配置项', () => {
      const booleanConfigs = [
        { force: true },
        { force: false },
        { merge: true },
        { merge: false },
        { defaultQuestions: true },
        { defaultQuestions: false },
        { gitInit: true },
        { gitInit: false },
        { install: true },
        { install: false },
      ]

      booleanConfigs.forEach(config => {
        const result = defineConfig(config)
        expect(result).toEqual(config)
      })
    })

    it('应该接受有效的模板配置', () => {
      const templateConfigs: Config[] = [
        { template: 'local-template' },
        { template: '/absolute/path/to/template' },
        { template: './relative/template' },
        {
          template: {
            type: 'npm',
            value: 'create-react-app',
          },
        },
        {
          template: {
            type: 'npm',
            value: '@vue/cli',
            registry: 'https://registry.npmjs.org',
          },
        },
        {
          template: {
            type: 'git',
            value: 'https://github.com/facebook/create-react-app.git',
          },
        },
      ]

      templateConfigs.forEach(config => {
        const result = defineConfig(config)
        expect(result.template).toEqual(config.template)
        expect(() => defineConfig(config)).not.toThrow()
      })
    })
  })

  describe('函数特性', () => {
    it('应该是纯函数（无副作用）', () => {
      const originalConfig: Config = {
        cwd: '/original',
        force: false,
      }
      const configCopy = { ...originalConfig }

      const result = defineConfig(originalConfig)

      // 验证原始对象未被修改
      expect(originalConfig).toEqual(configCopy)
      expect(result).toBe(originalConfig)
    })

    it('应该支持函数式编程模式', () => {
      const baseConfig: Config = { cwd: '/base' }
      const extendedConfig: Config = { ...baseConfig, force: true }

      const result = defineConfig(extendedConfig)

      expect(result).toBe(extendedConfig)
      expect(result.cwd).toBe('/base')
      expect(result.force).toBe(true)
    })

    it('应该支持配置组合', () => {
      const defaultConfig: Config = {
        force: false,
        defaultQuestions: true,
        gitInit: true,
        install: true,
      }

      const userConfig: Config = {
        cwd: '/user/path',
        force: true,
      }

      const combinedConfig = defineConfig({ ...defaultConfig, ...userConfig })

      expect(combinedConfig.cwd).toBe('/user/path')
      expect(combinedConfig.force).toBe(true) // 用户配置覆盖默认值
      expect(combinedConfig.defaultQuestions).toBe(true) // 保留默认值
      expect(combinedConfig.gitInit).toBe(true)
      expect(combinedConfig.install).toBe(true)
    })
  })

  describe('实际使用场景', () => {
    it('应该支持基本项目创建配置', () => {
      const basicConfig = defineConfig({
        template: 'vue',
        cwd: '/my/project',
      })

      expect(basicConfig.template).toBe('vue')
      expect(basicConfig.cwd).toBe('/my/project')
    })

    it('应该支持强制覆盖配置', () => {
      const forceConfig = defineConfig({
        force: true,
        merge: false,
      })

      expect(forceConfig.force).toBe(true)
      expect(forceConfig.merge).toBe(false)
    })

    it('应该支持 npm 模板配置', () => {
      const npmConfig = defineConfig({
        template: {
          type: 'npm',
          value: '@my/template',
          registry: 'https://npm.company.com',
        },
      })

      expect(npmConfig.template).toMatchObject({
        type: 'npm',
        value: '@my/template',
        registry: 'https://npm.company.com',
      })
    })

    it('应该支持 git 模板配置', () => {
      const gitConfig = defineConfig({
        template: {
          type: 'git',
          value: 'https://github.com/company/template.git',
        },
      })

      expect(gitConfig.template).toMatchObject({
        type: 'git',
        value: 'https://github.com/company/template.git',
      })
    })

    it('应该支持开发环境配置', () => {
      const devConfig = defineConfig({
        defaultQuestions: false, // 跳过交互
        gitInit: false, // 不初始化 git
        install: false, // 不安装依赖
      })

      expect(devConfig.defaultQuestions).toBe(false)
      expect(devConfig.gitInit).toBe(false)
      expect(devConfig.install).toBe(false)
    })

    it('应该支持生产环境配置', () => {
      const prodConfig = defineConfig({
        defaultQuestions: true, // 启用交互
        gitInit: true, // 初始化 git
        install: true, // 安装依赖
        force: false, // 安全模式，不覆盖
      })

      expect(prodConfig.defaultQuestions).toBe(true)
      expect(prodConfig.gitInit).toBe(true)
      expect(prodConfig.install).toBe(true)
      expect(prodConfig.force).toBe(false)
    })
  })

  describe('类型推导', () => {
    it('应该正确推导返回类型', () => {
      const config = {
        cwd: '/test',
        force: true,
      }

      const result = defineConfig(config)

      // TypeScript 应该能够推导出正确的类型
      expect(result).toHaveProperty('cwd')
      expect(result).toHaveProperty('force')
      expect(typeof result.cwd).toBe('string')
      expect(typeof result.force).toBe('boolean')
    })

    it('应该保持与 Config 接口的兼容性', () => {
      // 这个测试确保 defineConfig 返回的对象可以赋值给 Config 类型
      const config: Config = defineConfig({
        cwd: '/test',
        template: 'test-template',
      })

      expect(config).toBeDefined()
      expect(typeof config).toBe('object')
    })
  })

  describe('性能特性', () => {
    it('应该有最小的执行时间开销', () => {
      const config: Config = { cwd: '/test' }
      const start = performance.now()

      for (let i = 0; i < 10000; i++) {
        defineConfig(config)
      }

      const end = performance.now()
      const duration = end - start

      // 10000 次调用应该在合理时间内完成（<50ms）
      expect(duration).toBeLessThan(50)
    })

    it('不应该进行深拷贝（保持引用）', () => {
      const nestedObject = { a: 1, b: { c: 2 } }
      const config: Config = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        template: nestedObject as any,
      }

      const result = defineConfig(config)

      // 验证对象引用保持不变
      expect(result.template).toBe(nestedObject)
      expect(Object.is(result.template, nestedObject)).toBe(true)
    })
  })

  describe('错误处理', () => {
    it('应该在运行时不抛出错误', () => {
      const configs: Config[] = [
        {},
        { cwd: '' },
        { force: true },
        { template: undefined },
        {
          template: {
            type: 'npm',
            value: '',
          },
        },
      ]

      configs.forEach(config => {
        expect(() => defineConfig(config)).not.toThrow()
      })
    })

    it('应该保持函数调用的一致性', () => {
      const config: Config = { cwd: '/test' }

      // 多次调用应该返回相同的结果
      const result1 = defineConfig(config)
      const result2 = defineConfig(config)

      expect(result1).toBe(config)
      expect(result2).toBe(config)
      expect(result1).toBe(result2)
    })
  })
})
