/* eslint-disable @typescript-eslint/no-var-requires */
import * as generatorModule from '../../src/generator'
import {
  BaseGenerator,
  Generator,
  generateFile,
  type GeneratorOptions,
} from '../../src/generator'

describe('Generator 模块导出', () => {
  describe('模块导出完整性', () => {
    it('应该导出所有预期的类和函数', () => {
      expect(typeof generatorModule.BaseGenerator).toBe('function')
      expect(typeof generatorModule.Generator).toBe('function')
      expect(typeof generatorModule.generateFile).toBe('function')

      // 验证构造函数
      expect(BaseGenerator).toBeDefined()
      expect(Generator).toBeDefined()
      expect(generateFile).toBeDefined()
    })

    it('应该能够通过通配符导出访问所有功能', () => {
      expect(generatorModule).toBeDefined()
      const allExports = Object.keys(generatorModule)

      expect(allExports).toContain('BaseGenerator')
      expect(allExports).toContain('Generator')
      expect(allExports).toContain('generateFile')
    })

    it('应该导出正确的类型', () => {
      // 测试类型是否可用
      const options: GeneratorOptions = {
        src: '/test',
        dest: '/test',
      }

      expect(options).toBeDefined()
      expect(typeof options.src).toBe('string')
      expect(typeof options.dest).toBe('string')
    })
  })

  describe('类实例化', () => {
    it('应该能够实例化 BaseGenerator', () => {
      const baseGen = new BaseGenerator('/test/base')

      expect(baseGen).toBeInstanceOf(BaseGenerator)
      expect(baseGen.basedir).toBe('/test/base')
      expect(typeof baseGen.run).toBe('function')
      expect(typeof baseGen.prompting).toBe('function')
      expect(typeof baseGen.writing).toBe('function')
    })

    it('应该能够实例化 Generator', () => {
      const options: GeneratorOptions = {
        src: '/test/src',
        dest: '/test/dest',
      }

      const gen = new Generator(options)

      expect(gen).toBeInstanceOf(Generator)
      expect(gen).toBeInstanceOf(BaseGenerator) // 继承关系
      expect(gen.src).toBe('/test/src')
      expect(gen.dest).toBe('/test/dest')
    })
  })

  describe('继承关系', () => {
    it('应该验证 Generator 继承自 BaseGenerator', () => {
      const options: GeneratorOptions = {
        src: '/inheritance/test',
        dest: '/inheritance/output',
      }

      const gen = new Generator(options)

      expect(gen instanceof BaseGenerator).toBe(true)
      expect(gen instanceof Generator).toBe(true)

      // 验证继承的方法存在
      expect(typeof gen.copyFile).toBe('function')
      expect(typeof gen.copyFileSync).toBe('function')
      expect(typeof gen.copyTpl).toBe('function')
      expect(typeof gen.copyTplSync).toBe('function')
      expect(typeof gen.copyDirectory).toBe('function')
      expect(typeof gen.copyDirectorySync).toBe('function')
      expect(typeof gen.checkDir).toBe('function')
    })
  })

  describe('模块稳定性', () => {
    it('应该确保导出的对象不被意外修改', () => {
      const originalExports = { ...generatorModule }

      // 尝试修改导出对象（在严格模式下应该失败或者被忽略）
      try {
        ;(generatorModule as Record<string, unknown>).newProperty =
          'should not work'
      } catch {
        // 在严格模式下可能会抛出错误，这是预期的
      }

      // 核心导出应该保持不变
      expect(generatorModule.BaseGenerator).toBe(originalExports.BaseGenerator)
      expect(generatorModule.Generator).toBe(originalExports.Generator)
      expect(generatorModule.generateFile).toBe(originalExports.generateFile)
    })

    it('应该验证所有导出项的类型', () => {
      // BaseGenerator 应该是一个类
      expect(BaseGenerator.prototype).toBeDefined()
      expect(BaseGenerator.prototype.constructor).toBe(BaseGenerator)

      // Generator 应该是一个类
      expect(Generator.prototype).toBeDefined()
      expect(Generator.prototype.constructor).toBe(Generator)

      // generateFile 应该是一个函数
      expect(typeof generateFile).toBe('function')
      expect(generateFile.length).toBe(1) // 应该接受一个参数
    })
  })

  describe('使用示例', () => {
    it('应该提供完整的使用示例', () => {
      // 这个测试展示了如何使用导出的功能
      const exampleOptions: GeneratorOptions = {
        src: '/templates/react-component',
        dest: '/src/components',
        questions: [
          { name: 'componentName', message: '组件名称', type: 'text' },
          { name: 'withProps', message: '是否包含 Props?', type: 'confirm' },
        ],
        data: {
          author: 'Developer',
          license: 'MIT',
          framework: 'React',
        },
        renderTemplateOptions: {
          type: 'mustache',
        },
        onGeneratorDone: ctx => {
          console.log(`Generated ${ctx.src} to ${ctx.dest}`)
        },
      }

      // 验证所有属性都是有效的
      expect(typeof exampleOptions.src).toBe('string')
      expect(typeof exampleOptions.dest).toBe('string')
      expect(Array.isArray(exampleOptions.questions)).toBe(true)
      expect(typeof exampleOptions.data).toBe('object')
      expect(typeof exampleOptions.renderTemplateOptions).toBe('object')
      expect(typeof exampleOptions.onGeneratorDone).toBe('function')

      // 验证可以创建实例
      const generator = new Generator(exampleOptions)
      expect(generator).toBeInstanceOf(Generator)
      expect(generator).toBeInstanceOf(BaseGenerator)
    })
  })
})
