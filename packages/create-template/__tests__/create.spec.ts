import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedClass,
  type MockedFunction,
} from 'vitest'
import { CreateTemplate, type CreateTemplateOptions } from '../src/create'

// 导入 mock 后的模块
import { ProjectCreator } from '@eljs/create'
import { prompts } from '@eljs/utils/cli'
import { logger } from '@eljs/utils/logger'

// Mock 依赖模块
vi.mock('@eljs/create', async importOriginal => ({
  ...(await importOriginal<typeof import('@eljs/create')>()),
  ProjectCreator: vi.fn(),
}))
vi.mock('@eljs/utils/cli')
vi.mock('@eljs/utils/logger', async importOriginal => {
  const actual = await importOriginal<typeof import('@eljs/utils/logger')>()

  return {
    ...actual,
    logger: { ...actual.logger, event: vi.fn() },
  }
})

describe('CreateTemplate 类功能测试', () => {
  const mockedCreate = ProjectCreator as MockedClass<typeof ProjectCreator>
  const mockedPrompts = prompts as MockedFunction<typeof prompts>

  beforeEach(() => {
    vi.clearAllMocks()

    // 设置默认的mock实现
    mockedCreate.mockImplementation(
      () =>
        ({
          run: vi.fn().mockResolvedValue(undefined),
        }) as never,
    )
  })

  describe('构造函数测试', () => {
    it('应该正确初始化 CreateTemplate 实例', () => {
      const options: CreateTemplateOptions = {
        cwd: '/test/path',
        template: 'template-npm-web',
        force: true,
        merge: false,
      }

      const createTemplate = new CreateTemplate(options)

      expect(createTemplate.constructorOptions).toEqual(options)
      expect(Object.isFrozen(createTemplate.constructorOptions)).toBe(true)
      expect(createTemplate.cwd).toBe('/test/path')
    })

    it('应该使用默认工作目录当未提供 cwd 时', () => {
      const originalCwd = process.cwd()
      const options: CreateTemplateOptions = {}

      const createTemplate = new CreateTemplate(options)

      expect(createTemplate.cwd).toBe(originalCwd)
      expect(createTemplate.constructorOptions).toEqual(options)
    })

    it('应该处理部分选项', () => {
      const options: CreateTemplateOptions = {
        force: true,
      }

      const createTemplate = new CreateTemplate(options)

      expect(createTemplate.constructorOptions.force).toBe(true)
      expect(createTemplate.constructorOptions.template).toBeUndefined()
      expect(createTemplate.constructorOptions.merge).toBeUndefined()
    })
  })

  describe('run 方法测试', () => {
    let createTemplate: CreateTemplate
    const projectName = 'test-project'

    beforeEach(() => {
      createTemplate = new CreateTemplate({
        cwd: '/test/path',
        template: 'template-npm-web',
      })
    })

    it('应该成功运行项目创建流程', async () => {
      const mockCreateInstance = {
        run: vi.fn().mockResolvedValue(undefined),
      }
      mockedCreate.mockImplementation(function MockCreate() {
        return mockCreateInstance as never
      })

      await createTemplate.run(projectName)

      expect(mockedCreate).toHaveBeenCalledWith({
        cwd: '/test/path',
        template: {
          type: 'npm',
          value: '@eljs/create-plugin-npm-web@0.12.1',
          registry: 'https://registry.npmjs.org/',
          integrity:
            'sha512-PnCXo/ZbnGnQqdFQjG9jI1jXRn9ZV8l4DWE6Txxjmu40PkCF6MRfqCGpCBd4PN2flAKCph+DUaNrKM+6lKrrww==',
          trusted: true,
        },
      })
      expect(mockCreateInstance.run).toHaveBeenCalledWith(projectName)
    })

    it('应该拒绝显式传入的无效模板', async () => {
      createTemplate = new CreateTemplate({
        // @ts-expect-error 验证 JavaScript 调用方绕过静态类型后的运行时防御
        template: 'invalid-template',
      })

      await expect(createTemplate.run(projectName)).rejects.toMatchObject({
        code: 'CREATE_INVALID_OPTIONS',
        details: { template: 'invalid-template' },
      })
      expect(mockedPrompts).not.toHaveBeenCalled()
    })
  })

  describe('_getTemplate 私有方法测试', () => {
    describe('模板选择测试', () => {
      it('应该使用提供的有效模板', async () => {
        const createTemplate = new CreateTemplate({
          template: 'template-npm-web',
        })

        const mockCreateInstance = {
          run: vi.fn().mockResolvedValue(undefined),
        }
        mockedCreate.mockImplementation(function MockCreate() {
          return mockCreateInstance as never
        })

        await createTemplate.run('test-project')

        // 验证没有调用 prompts 来选择模板
        expect(mockedPrompts).not.toHaveBeenCalled()
      })

      it('应该提示用户选择模板当未提供模板时', async () => {
        const createTemplate = new CreateTemplate()

        mockedPrompts.mockResolvedValueOnce({ template: 'template-npm-web' })

        const mockCreateInstance = {
          run: vi.fn().mockResolvedValue(undefined),
        }
        mockedCreate.mockImplementation(function MockCreate() {
          return mockCreateInstance as never
        })

        await createTemplate.run('test-project')

        expect(mockedPrompts).toHaveBeenCalledWith(
          {
            type: 'select',
            name: 'template',
            message: 'Select the application template',
            choices: [
              { title: 'Web Common Template', value: 'template-npm-web' },
              { title: 'Node Common Template', value: 'template-npm-node' },
            ],
          },
          { onCancel: expect.any(Function) },
        )
      })

      it('取消选择时应该记录事件并抛出稳定领域错误', async () => {
        const createTemplate = new CreateTemplate()
        mockedPrompts.mockImplementationOnce((_question, options) => {
          const onCancel = options?.onCancel as (() => void) | undefined
          onCancel?.()
          return Promise.resolve({})
        })

        await expect(createTemplate.run('test-project')).rejects.toMatchObject({
          code: 'CREATE_OPERATION_CANCELLED',
          message: 'Create template operation was cancelled by the user',
        })
        expect(logger.event).toHaveBeenCalledWith('Cancel create template')
      })

      it('取消日志失败时仍然保留取消错误', async () => {
        const createTemplate = new CreateTemplate()
        vi.mocked(logger.event).mockImplementationOnce(() => {
          throw new Error('Logger failed')
        })
        mockedPrompts.mockImplementationOnce((_question, options) => {
          const onCancel = options?.onCancel as (() => void) | undefined
          onCancel?.()
          return Promise.resolve({})
        })

        await expect(createTemplate.run('test-project')).rejects.toMatchObject({
          code: 'CREATE_OPERATION_CANCELLED',
        })
      })

      it('应该拒绝显式提供的无效模板', async () => {
        const createTemplate = new CreateTemplate({
          // @ts-expect-error 验证 JavaScript 调用方绕过静态类型后的运行时防御
          template: 'invalid-template',
        })

        await expect(createTemplate.run('test-project')).rejects.toMatchObject({
          code: 'CREATE_INVALID_OPTIONS',
          details: { template: 'invalid-template' },
        })
        expect(mockedPrompts).not.toHaveBeenCalled()
      })
    })

    describe('断言验证测试', () => {
      it('应该在直接提供空模板时抛出错误', async () => {
        const createTemplate = new CreateTemplate({
          // @ts-expect-error 验证 JavaScript 调用方绕过静态类型后的运行时防御
          template: '',
        })

        await expect(createTemplate.run('test-project')).rejects.toThrow()
      })

      it('应该在模板答案为空时抛出错误', async () => {
        const createTemplate = new CreateTemplate()

        mockedPrompts.mockResolvedValueOnce({ template: '' })

        await expect(createTemplate.run('test-project')).rejects.toThrow(
          'Expected an application template',
        )
      })

      it('应该在找不到对应配置时抛出错误', async () => {
        const createTemplate = new CreateTemplate({
          // @ts-expect-error 验证 JavaScript 调用方绕过静态类型后的运行时防御
          template: 'nonexistent-template',
        })

        await expect(createTemplate.run('test-project')).rejects.toThrow(
          'Unknown application template `nonexistent-template`',
        )
      })
    })
  })

  describe('集成测试', () => {
    it('应该完整执行从配置到创建的流程', async () => {
      const createTemplate = new CreateTemplate({
        cwd: '/custom/path',
        force: true,
        merge: false,
      })

      mockedPrompts.mockResolvedValueOnce({ template: 'template-npm-web' })

      const mockCreateInstance = {
        run: vi.fn().mockResolvedValue(undefined),
      }
      mockedCreate.mockImplementation(function MockCreate() {
        return mockCreateInstance as never
      })

      await createTemplate.run('my-project')

      expect(mockedPrompts).toHaveBeenCalledTimes(1)
      expect(mockedCreate).toHaveBeenCalledWith({
        cwd: '/custom/path',
        force: true,
        merge: false,
        template: {
          type: 'npm',
          value: '@eljs/create-plugin-npm-web@0.12.1',
          registry: 'https://registry.npmjs.org/',
          integrity:
            'sha512-PnCXo/ZbnGnQqdFQjG9jI1jXRn9ZV8l4DWE6Txxjmu40PkCF6MRfqCGpCBd4PN2flAKCph+DUaNrKM+6lKrrww==',
          trusted: true,
        },
      })
      expect(mockCreateInstance.run).toHaveBeenCalledWith('my-project')
    })

    it('应该正确处理用户取消操作', async () => {
      const createTemplate = new CreateTemplate({})

      mockedPrompts.mockRejectedValueOnce(new Error('用户取消'))

      await expect(createTemplate.run('test-project')).rejects.toThrow(
        '用户取消',
      )
    })
  })

  describe('边界情况测试', () => {
    it('应该处理空项目名称', async () => {
      const createTemplate = new CreateTemplate({
        template: 'template-npm-web',
      })

      const mockCreateInstance = {
        run: vi.fn().mockResolvedValue(undefined),
      }
      mockedCreate.mockImplementation(function MockCreate() {
        return mockCreateInstance as never
      })

      await createTemplate.run('')

      expect(mockCreateInstance.run).toHaveBeenCalledWith('')
    })

    it('应该处理特殊字符的项目名称', async () => {
      const createTemplate = new CreateTemplate({
        template: 'template-npm-web',
      })

      const mockCreateInstance = {
        run: vi.fn().mockResolvedValue(undefined),
      }
      mockedCreate.mockImplementation(function MockCreate() {
        return mockCreateInstance as never
      })

      const specialProjectName = 'my-project@1.0.0-beta.1'
      await createTemplate.run(specialProjectName)

      expect(mockCreateInstance.run).toHaveBeenCalledWith(specialProjectName)
    })

    it('应该拒绝同时启用 force 与 merge', () => {
      const options: CreateTemplateOptions = {
        cwd: '/complex/path',
        template: 'template-npm-web',
        force: true,
        merge: true,
      }

      expect(() => new CreateTemplate(options)).toThrow(
        '`force` and `merge` cannot be enabled together',
      )
      try {
        new CreateTemplate(options)
      } catch (error) {
        expect(error).toMatchObject({ code: 'CREATE_INVALID_OPTIONS' })
      }
    })
  })
})
