/* eslint-disable @typescript-eslint/no-var-requires */
import {
  generateFile,
  Generator,
  type GeneratorOptions,
} from '../../src/generator'

// Mock 依赖项
jest.mock('../../src/generator/generator')

describe('generateFile 文件生成函数', () => {
  const MockGenerator = Generator as jest.MockedClass<typeof Generator>
  let mockGeneratorInstance: jest.Mocked<Generator>

  beforeEach(() => {
    jest.clearAllMocks()

    // 创建 mock 实例
    mockGeneratorInstance = {
      run: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Generator>

    MockGenerator.mockImplementation(() => mockGeneratorInstance)
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

      expect(MockGenerator).toHaveBeenCalledWith(options)
      expect(mockGeneratorInstance.run).toHaveBeenCalled()
    })

    it('应该处理最小配置', async () => {
      const minimalOptions: GeneratorOptions = {
        src: '/simple/template',
        dest: '/simple/output',
      }

      await generateFile(minimalOptions)

      expect(MockGenerator).toHaveBeenCalledWith(minimalOptions)
      expect(mockGeneratorInstance.run).toHaveBeenCalled()
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
        onGeneratorDone: jest.fn(),
      }

      await generateFile(completeOptions)

      expect(MockGenerator).toHaveBeenCalledWith(completeOptions)
      expect(mockGeneratorInstance.run).toHaveBeenCalledTimes(1)
    })
  })

  describe('错误处理', () => {
    it('应该传递 Generator 构造错误', async () => {
      MockGenerator.mockImplementation(() => {
        throw new Error('Generator construction failed')
      })

      const options: GeneratorOptions = {
        src: '/invalid/template',
        dest: '/invalid/output',
      }

      await expect(generateFile(options)).rejects.toThrow(
        'Generator construction failed',
      )
    })

    it('应该传递 Generator 运行错误', async () => {
      mockGeneratorInstance.run.mockRejectedValue(
        new Error('Generation failed'),
      )

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

      expect(MockGenerator).toHaveBeenCalledWith(options)
      expect(mockGeneratorInstance.run).toHaveBeenCalled()
    })

    it('应该支持回调函数', async () => {
      const onDone = jest.fn()
      const options: GeneratorOptions = {
        src: '/template',
        dest: '/output',
        onGeneratorDone: onDone,
      }

      await generateFile(options)

      expect(MockGenerator).toHaveBeenCalledWith(options)
      expect(options.onGeneratorDone).toBe(onDone)
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

      expect(MockGenerator).toHaveBeenCalledWith(
        expect.objectContaining({
          data: typedData,
        }),
      )
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

      expect(MockGenerator).toHaveBeenCalledWith(options)
      expect(typeof options.src).toBe('function')
      expect(typeof options.dest).toBe('function')
      expect(typeof options.data).toBe('function')
    })
  })

  describe('边界情况', () => {
    it('应该处理空选项', async () => {
      const emptyOptions: GeneratorOptions = {
        src: '',
        dest: '',
      }

      await generateFile(emptyOptions)

      expect(MockGenerator).toHaveBeenCalledWith(emptyOptions)
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

      expect(MockGenerator).toHaveBeenCalledWith(complexOptions)
    })
  })
})
