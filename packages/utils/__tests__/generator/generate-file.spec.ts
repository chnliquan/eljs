import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

import {
  generateFile,
  Generator,
  type GeneratorOptions,
} from '../../src/generator'

describe('generateFile 文件生成函数', () => {
  let mockRun: MockInstance<Generator['run']>

  beforeEach(() => {
    mockRun = vi.spyOn(Generator.prototype, 'run').mockResolvedValue(true)
  })

  describe('基本功能', () => {
    it('应该创建 Generator 实例并运行', async () => {
      const options: GeneratorOptions = {
        src: '/template/source',
        dest: '/project/destination',
        questions: [
          { name: 'projectName', message: '项目名称', type: 'text' },
          { name: 'author', message: '作者', type: 'text' },
        ],
        data: { version: '1.0.0', license: 'MIT' },
      }

      await generateFile(options)

      expect(mockRun.mock.contexts[0]).toBeInstanceOf(Generator)
      expect(mockRun.mock.contexts[0]).toMatchObject(options)
      expect(mockRun).toHaveBeenCalledOnce()
    })

    it('应该处理最小配置', async () => {
      const minimalOptions: GeneratorOptions = {
        src: '/simple/template',
        dest: '/simple/output',
      }

      await generateFile(minimalOptions)

      expect(mockRun.mock.contexts[0]).toMatchObject(minimalOptions)
      expect(mockRun).toHaveBeenCalledOnce()
    })

    it('应该传递所有选项给 Generator', async () => {
      const completeOptions: GeneratorOptions = {
        src: '/full/template',
        dest: '/full/output',
        basedir: '/custom/base',
        questions: [
          {
            name: 'framework',
            message: '框架',
            type: 'select',
            choices: [
              { title: 'React', value: 'react' },
              { title: 'Vue', value: 'vue' },
            ],
          },
          { name: 'typescript', message: '使用 TypeScript?', type: 'confirm' },
        ],
        data: {
          author: 'Developer',
          email: 'dev@example.com',
          year: new Date().getFullYear(),
        },
        renderTemplateOptions: {
          type: 'ejs',
          options: { delimiter: '%' },
        },
        onGeneratorDone: vi.fn(),
      }

      await generateFile(completeOptions)

      expect(mockRun.mock.contexts[0]).toMatchObject(completeOptions)
      expect(mockRun).toHaveBeenCalledTimes(1)
    })
  })

  describe('错误处理', () => {
    it('应该传递 Generator 构造错误', async () => {
      const options: GeneratorOptions = {
        get src(): string {
          throw new Error('Generator construction failed')
        },
        dest: '/invalid/output',
      }

      await expect(generateFile(options)).rejects.toThrow(
        'Generator construction failed',
      )
      expect(mockRun).not.toHaveBeenCalled()
    })

    it('应该传递 Generator 运行错误', async () => {
      mockRun.mockRejectedValue(new Error('Generation failed'))

      const options: GeneratorOptions = {
        src: '/template',
        dest: '/output',
      }

      await expect(generateFile(options)).rejects.toThrow('Generation failed')
    })
  })

  describe('集成测试', () => {
    it('应该模拟完整的文件生成流程', async () => {
      const options: GeneratorOptions = {
        src: '/react-template',
        dest: '/my-react-app',
        questions: [
          { name: 'appName', message: '应用名称', type: 'text' },
          {
            name: 'useTypeScript',
            message: '使用 TypeScript?',
            type: 'confirm',
          },
        ],
        data: {
          author: 'John Doe',
          license: 'MIT',
          version: '0.1.0',
        },
        renderTemplateOptions: { type: 'mustache' },
      }

      await generateFile(options)

      expect(mockRun.mock.contexts[0]).toMatchObject(options)
      expect(mockRun).toHaveBeenCalledOnce()
    })

    it('应该支持回调函数', async () => {
      const onDone = vi.fn()
      const options: GeneratorOptions = {
        src: '/template',
        dest: '/output',
        onGeneratorDone: onDone,
      }

      await generateFile(options)

      expect(mockRun.mock.contexts[0]).toMatchObject(options)
      expect((mockRun.mock.contexts[0] as Generator).onGeneratorDone).toBe(
        onDone,
      )
    })
  })

  describe('类型安全', () => {
    it('应该保持选项的类型安全', async () => {
      interface ProjectConfig {
        name: string
        framework: 'react' | 'vue' | 'svelte'
        features: {
          routing: boolean
          stateManagement: boolean
          testing: boolean
        }
        dependencies: string[]
      }

      const typedData: ProjectConfig = {
        name: 'TypedProject',
        framework: 'react',
        features: {
          routing: true,
          stateManagement: true,
          testing: false,
        },
        dependencies: ['react', 'react-dom', 'typescript'],
      }

      const options: GeneratorOptions = {
        src: '/typed-template',
        dest: '/typed-output',
        data: typedData,
      }

      await generateFile(options)

      expect((mockRun.mock.contexts[0] as Generator).data).toBe(typedData)
    })

    it('应该处理函数形式的配置', async () => {
      const srcFn = (prompts: Record<string, unknown>) =>
        `/templates/${prompts.templateType}`
      const destFn = (prompts: Record<string, unknown>) =>
        `/projects/${prompts.projectName}`
      const dataFn = (prompts: Record<string, unknown>) => ({
        ...prompts,
        timestamp: Date.now(),
      })

      const options: GeneratorOptions = {
        src: srcFn,
        dest: destFn,
        data: dataFn,
      }

      await generateFile(options)

      const generator = mockRun.mock.contexts[0] as Generator
      expect(generator.src).toBe(srcFn)
      expect(generator.dest).toBe(destFn)
      expect(generator.data).toBe(dataFn)
    })
  })

  describe('边界情况', () => {
    it('应该处理空选项', async () => {
      const emptyOptions: GeneratorOptions = {
        src: '',
        dest: '',
      }

      await generateFile(emptyOptions)

      expect(mockRun.mock.contexts[0]).toMatchObject(emptyOptions)
    })

    it('应该处理复杂的嵌套配置', async () => {
      const complexOptions: GeneratorOptions = {
        src: '/complex/nested/template/structure',
        dest: '/complex/nested/output/structure',
        questions: [
          {
            name: 'projectConfig',
            message: '项目配置',
            type: 'select',
            choices: [
              {
                title: '基础配置',
                value: { type: 'basic', features: ['core'] },
              },
              {
                title: '高级配置',
                value: { type: 'advanced', features: ['core', 'auth', 'api'] },
              },
            ],
          },
        ],
        data: {
          meta: {
            generator: 'eljs',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
          },
          defaults: {
            language: 'typescript',
            packageManager: 'pnpm',
            testing: 'jest',
          },
        },
        renderTemplateOptions: {
          type: 'ejs',
          options: {
            delimiter: '%',
            strict: true,
          },
        },
      }

      await generateFile(complexOptions)

      expect(mockRun.mock.contexts[0]).toMatchObject(complexOptions)
    })
  })

  it.each([true, false])(
    '应该等待生成结束并返回 undefined：%s',
    async result => {
      const completion = Promise.withResolvers<boolean>()
      mockRun.mockReturnValue(completion.promise)
      const settled = vi.fn()
      const generated = generateFile({ src: '/template', dest: '/output' })
      void generated.then(settled)

      await Promise.resolve()
      expect(settled).not.toHaveBeenCalled()

      completion.resolve(result)
      await expect(generated).resolves.toBeUndefined()
      expect(settled).toHaveBeenCalledOnce()
    },
  )
})
