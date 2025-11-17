import { defaultConfig } from '../src/config'
import { CreateTemplate, type CreateTemplateOptions } from '../src/create'

// 导入 mock 后的模块
import { Create } from '@eljs/create'
import { prompts } from '@eljs/utils'
import assert from 'node:assert'

import { objectToArray, onCancel } from '../src/utils'

// Mock 依赖模块
jest.mock('@eljs/create')
jest.mock('@eljs/utils')
jest.mock('node:assert')
jest.mock('../src/utils')

describe('CreateTemplate 类功能测试', () => {
  const mockedCreate = Create as jest.MockedClass<typeof Create>
  const mockedPrompts = prompts as jest.MockedFunction<typeof prompts>
  const mockedObjectToArray = objectToArray as jest.MockedFunction<
    typeof objectToArray
  >
  const mockedOnCancel = onCancel as jest.MockedFunction<typeof onCancel>
  const mockedAssert = assert as jest.MockedFunction<typeof assert>

  beforeEach(() => {
    jest.clearAllMocks()

    // 设置默认的mock实现
    mockedCreate.mockImplementation(
      () =>
        ({
          run: jest.fn().mockResolvedValue(undefined),
        }) as never,
    )

    mockedObjectToArray.mockImplementation((obj: Record<string, unknown>) =>
      Object.keys(obj).map(key => ({
        title: obj[key] as string,
        value: key,
      })),
    )

    mockedAssert.mockImplementation(
      (condition: unknown, message?: string | Error) => {
        if (!condition) {
          const errorMessage =
            typeof message === 'string'
              ? message
              : message?.message || 'Assertion failed'
          throw new Error(errorMessage)
        }
      },
    )
  })

  describe('构造函数测试', () => {
    it('应该正确初始化 CreateTemplate 实例', () => {
      const options: CreateTemplateOptions = {
        cwd: '/test/path',
        scene: 'npm',
        template: 'template-npm-web',
        force: true,
        merge: false,
      }

      const createTemplate = new CreateTemplate(options)

      expect(createTemplate.constructorOptions).toEqual(options)
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
        scene: 'npm',
        force: true,
      }

      const createTemplate = new CreateTemplate(options)

      expect(createTemplate.constructorOptions.scene).toBe('npm')
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
        scene: 'npm',
        template: 'template-npm-web',
      })
    })

    it('应该成功运行项目创建流程', async () => {
      const mockCreateInstance = {
        run: jest.fn().mockResolvedValue(undefined),
      }
      mockedCreate.mockImplementation(() => mockCreateInstance as never)

      await createTemplate.run(projectName)

      expect(mockedCreate).toHaveBeenCalledWith({
        cwd: '/test/path',
        scene: 'npm',
        template: defaultConfig.templates.npm['template-npm-web'],
      })
      expect(mockCreateInstance.run).toHaveBeenCalledWith(projectName)
    })

    it('应该处理获取模板失败的情况', async () => {
      // 模拟无效的场景
      createTemplate = new CreateTemplate({
        scene: 'invalid-scene',
        template: 'invalid-template',
      })

      mockedPrompts.mockResolvedValueOnce({ scene: 'npm' })
      mockedPrompts.mockResolvedValueOnce({ template: 'template-npm-web' })
      mockedObjectToArray.mockReturnValue([{ title: 'NPM', value: 'npm' }])

      const mockCreateInstance = {
        run: jest.fn().mockResolvedValue(undefined),
      }
      mockedCreate.mockImplementation(() => mockCreateInstance as never)

      await createTemplate.run(projectName)

      expect(mockedPrompts).toHaveBeenCalledTimes(2)
      expect(mockCreateInstance.run).toHaveBeenCalledWith(projectName)
    })
  })

  describe('_getTemplate 私有方法测试', () => {
    describe('场景选择测试', () => {
      it('应该使用提供的有效场景', async () => {
        const createTemplate = new CreateTemplate({
          scene: 'npm',
          template: 'template-npm-web',
        })

        // 通过 run 方法间接测试 _getTemplate
        const mockCreateInstance = {
          run: jest.fn().mockResolvedValue(undefined),
        }
        mockedCreate.mockImplementation(() => mockCreateInstance as never)

        await createTemplate.run('test-project')

        // 验证没有调用 prompts 来选择场景
        expect(mockedPrompts).not.toHaveBeenCalled()
      })

      it('应该提示用户选择场景当未提供场景时', async () => {
        const createTemplate = new CreateTemplate({})

        mockedPrompts.mockResolvedValueOnce({ scene: 'npm' })
        mockedPrompts.mockResolvedValueOnce({ template: 'template-npm-web' })
        mockedObjectToArray.mockReturnValueOnce([
          { title: 'NPM', value: 'npm' },
        ])

        const mockCreateInstance = {
          run: jest.fn().mockResolvedValue(undefined),
        }
        mockedCreate.mockImplementation(() => mockCreateInstance as never)

        await createTemplate.run('test-project')

        expect(mockedPrompts).toHaveBeenCalledWith(
          {
            type: 'select',
            name: 'scene',
            message: 'Select the application scene',
            choices: [{ title: 'NPM', value: 'npm' }],
          },
          { onCancel: mockedOnCancel },
        )
      })

      it('应该提示用户选择场景当提供无效场景时', async () => {
        const createTemplate = new CreateTemplate({
          scene: 'invalid-scene',
        })

        mockedPrompts.mockResolvedValueOnce({ scene: 'npm' })
        mockedPrompts.mockResolvedValueOnce({ template: 'template-npm-web' })
        mockedObjectToArray.mockReturnValueOnce([
          { title: 'NPM', value: 'npm' },
        ])

        const mockCreateInstance = {
          run: jest.fn().mockResolvedValue(undefined),
        }
        mockedCreate.mockImplementation(() => mockCreateInstance as never)

        await createTemplate.run('test-project')

        expect(mockedPrompts).toHaveBeenCalledWith(
          {
            type: 'select',
            name: 'scene',
            message: 'Select the application scene',
            choices: [{ title: 'NPM', value: 'npm' }],
          },
          { onCancel: mockedOnCancel },
        )
      })
    })

    describe('模板选择测试', () => {
      it('应该使用提供的有效模板', async () => {
        const createTemplate = new CreateTemplate({
          scene: 'npm',
          template: 'template-npm-web',
        })

        const mockCreateInstance = {
          run: jest.fn().mockResolvedValue(undefined),
        }
        mockedCreate.mockImplementation(() => mockCreateInstance as never)

        await createTemplate.run('test-project')

        // 验证没有调用 prompts 来选择模板
        expect(mockedPrompts).not.toHaveBeenCalled()
      })

      it('应该提示用户选择模板当未提供模板时', async () => {
        const createTemplate = new CreateTemplate({
          scene: 'npm',
        })

        mockedPrompts.mockResolvedValueOnce({ template: 'template-npm-web' })

        const mockCreateInstance = {
          run: jest.fn().mockResolvedValue(undefined),
        }
        mockedCreate.mockImplementation(() => mockCreateInstance as never)

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
          { onCancel: mockedOnCancel },
        )
      })

      it('应该提示用户选择模板当提供无效模板时', async () => {
        const createTemplate = new CreateTemplate({
          scene: 'npm',
          template: 'invalid-template',
        })

        mockedPrompts.mockResolvedValueOnce({ template: 'template-npm-web' })

        const mockCreateInstance = {
          run: jest.fn().mockResolvedValue(undefined),
        }
        mockedCreate.mockImplementation(() => mockCreateInstance as never)

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
          { onCancel: mockedOnCancel },
        )
      })
    })

    describe('断言验证测试', () => {
      it('应该在场景答案为空时抛出错误', async () => {
        const createTemplate = new CreateTemplate({})

        mockedPrompts
          .mockResolvedValueOnce({ scene: 'npm' })
          .mockResolvedValueOnce({ template: '' }) // 模板答案为空

        mockedObjectToArray.mockReturnValueOnce([
          { title: 'NPM', value: 'npm' },
        ])

        await expect(createTemplate.run('test-project')).rejects.toThrow(
          'Excepted the application template.',
        )
      })

      it('应该在直接提供空场景时抛出错误', async () => {
        const createTemplate = new CreateTemplate({
          scene: '',
          template: '',
        })

        await expect(createTemplate.run('test-project')).rejects.toThrow()
      })

      it('应该在模板答案为空时抛出错误', async () => {
        const createTemplate = new CreateTemplate({
          scene: 'npm',
        })

        mockedPrompts.mockResolvedValueOnce({ template: '' })

        await expect(createTemplate.run('test-project')).rejects.toThrow(
          'Excepted the application template.',
        )
      })

      it('应该在找不到对应配置时抛出错误', async () => {
        const createTemplate = new CreateTemplate({
          scene: 'npm',
          template: 'nonexistent-template',
        })

        // 由于模板不存在于配置中，会触发 prompts 询问
        // 我们需要模拟用户选择一个不存在的模板
        mockedPrompts.mockResolvedValueOnce({ template: 'still-nonexistent' })

        await expect(createTemplate.run('test-project')).rejects.toThrow(
          'The selected scene `npm` and template `still-nonexistent` do not corresponding any configuration.',
        )
      })
    })
  })

  describe('_formatTemplate 私有方法测试', () => {
    it('应该正确格式化模板对象', () => {
      const createTemplate = new CreateTemplate({})
      const templates = defaultConfig.templates.npm

      // 通过访问私有方法进行测试（仅用于测试目的）
      const formattedTemplates = (
        createTemplate as never as {
          _formatTemplate: (
            template: typeof templates,
          ) => Array<{ title: string; value: string }>
        }
      )._formatTemplate(templates)

      expect(formattedTemplates).toEqual([
        { title: 'Web Common Template', value: 'template-npm-web' },
        { title: 'Node Common Template', value: 'template-npm-node' },
      ])
    })

    it('应该处理空模板对象', () => {
      const createTemplate = new CreateTemplate({})
      const emptyTemplates = {}

      const formattedTemplates = (
        createTemplate as never as {
          _formatTemplate: (
            template: typeof emptyTemplates,
          ) => Array<{ title: string; value: string }>
        }
      )._formatTemplate(emptyTemplates)

      expect(formattedTemplates).toEqual([])
    })

    it('应该处理单个模板', () => {
      const createTemplate = new CreateTemplate({})
      const singleTemplate = {
        testTemplate: {
          type: 'npm' as const,
          description: 'Test Template',
          value: '@test/template',
        },
      }

      const formattedTemplates = (
        createTemplate as never as {
          _formatTemplate: (
            template: typeof singleTemplate,
          ) => Array<{ title: string; value: string }>
        }
      )._formatTemplate(singleTemplate)

      expect(formattedTemplates).toEqual([
        { title: 'Test Template', value: 'testTemplate' },
      ])
    })
  })

  describe('集成测试', () => {
    it('应该完整执行从配置到创建的流程', async () => {
      const createTemplate = new CreateTemplate({
        cwd: '/custom/path',
        force: true,
        merge: false,
      })

      mockedPrompts
        .mockResolvedValueOnce({ scene: 'npm' })
        .mockResolvedValueOnce({ template: 'template-npm-web' })

      mockedObjectToArray.mockReturnValueOnce([{ title: 'NPM', value: 'npm' }])

      const mockCreateInstance = {
        run: jest.fn().mockResolvedValue(undefined),
      }
      mockedCreate.mockImplementation(() => mockCreateInstance as never)

      await createTemplate.run('my-project')

      expect(mockedPrompts).toHaveBeenCalledTimes(2)
      expect(mockedCreate).toHaveBeenCalledWith({
        cwd: '/custom/path',
        force: true,
        merge: false,
        template: defaultConfig.templates.npm['template-npm-web'],
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
        scene: 'npm',
        template: 'template-npm-web',
      })

      const mockCreateInstance = {
        run: jest.fn().mockResolvedValue(undefined),
      }
      mockedCreate.mockImplementation(() => mockCreateInstance as never)

      await createTemplate.run('')

      expect(mockCreateInstance.run).toHaveBeenCalledWith('')
    })

    it('应该处理特殊字符的项目名称', async () => {
      const createTemplate = new CreateTemplate({
        scene: 'npm',
        template: 'template-npm-web',
      })

      const mockCreateInstance = {
        run: jest.fn().mockResolvedValue(undefined),
      }
      mockedCreate.mockImplementation(() => mockCreateInstance as never)

      const specialProjectName = 'my-project@1.0.0-beta.1'
      await createTemplate.run(specialProjectName)

      expect(mockCreateInstance.run).toHaveBeenCalledWith(specialProjectName)
    })

    it('应该正确传递所有构造函数选项到 Create 实例', async () => {
      const options: CreateTemplateOptions = {
        cwd: '/complex/path',
        scene: 'npm',
        template: 'template-npm-web',
        force: true,
        merge: true,
      }

      const createTemplate = new CreateTemplate(options)

      const mockCreateInstance = {
        run: jest.fn().mockResolvedValue(undefined),
      }
      mockedCreate.mockImplementation(() => mockCreateInstance as never)

      await createTemplate.run('test-project')

      expect(mockedCreate).toHaveBeenCalledWith({
        cwd: '/complex/path',
        scene: 'npm',
        force: true,
        merge: true,
        template: defaultConfig.templates.npm['template-npm-web'],
      })
    })
  })
})
