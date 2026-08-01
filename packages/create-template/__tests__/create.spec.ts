import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedClass,
  type MockedFunction,
} from 'vitest'
import { defaultConfig, type TemplateConfig } from '../src/config'
import { CreateTemplate, type CreateTemplateOptions } from '../src/create'

// 导入 mock 后的模块
import { ProjectCreator } from '@eljs/create'
import { prompts } from '@eljs/utils'

import { objectToArray, onCancel } from '../src/utils'

// Mock 依赖模块
vi.mock('@eljs/create', async importOriginal => ({
  ...(await importOriginal<typeof import('@eljs/create')>()),
  ProjectCreator: vi.fn(),
}))
vi.mock('@eljs/utils/cli', async () => import('@eljs/utils'))
vi.mock('@eljs/utils')
vi.mock('../src/utils')

describe('CreateTemplate 类功能测试', () => {
  const mockedCreate = ProjectCreator as MockedClass<typeof ProjectCreator>
  const mockedPrompts = prompts as MockedFunction<typeof prompts>
  const mockedObjectToArray = objectToArray as MockedFunction<
    typeof objectToArray
  >
  const mockedOnCancel = onCancel as MockedFunction<typeof onCancel>

  beforeEach(() => {
    vi.clearAllMocks()

    // 设置默认的mock实现
    mockedCreate.mockImplementation(
      () =>
        ({
          run: vi.fn().mockResolvedValue(undefined),
        }) as never,
    )

    mockedObjectToArray.mockImplementation((obj: Record<string, unknown>) =>
      Object.keys(obj).map(key => ({
        title: obj[key] as string,
        value: key,
      })),
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
        scene: 'npm',
        force: true,
      }

      const createTemplate = new CreateTemplate(options)

      expect(createTemplate.constructorOptions.scene).toBe('npm')
      expect(createTemplate.constructorOptions.force).toBe(true)
      expect(createTemplate.constructorOptions.template).toBeUndefined()
      expect(createTemplate.constructorOptions.merge).toBeUndefined()
    })

    it('应该校验并深度冻结调用方传入的目录快照', () => {
      const catalog: TemplateConfig = {
        scenes: { local: 'Local' },
        templates: {
          local: {
            fixture: {
              description: 'Fixture Template',
              type: 'local',
              value: '/template/original',
            },
          },
        },
      }

      const createTemplate = new CreateTemplate({ catalog })
      catalog.templates.local.fixture.value = '/template/changed'

      expect(createTemplate.constructorOptions.catalog).not.toBe(catalog)
      expect(
        createTemplate.constructorOptions.catalog?.templates.local.fixture
          .value,
      ).toBe('/template/original')
      expect(
        Object.isFrozen(
          createTemplate.constructorOptions.catalog?.templates.local.fixture,
        ),
      ).toBe(true)
    })

    it('应该拒绝场景和模板映射不一致的目录', () => {
      const catalog = {
        scenes: { web: 'Web' },
        templates: { node: {} },
      }

      expect(
        () => new CreateTemplate({ catalog: catalog as TemplateConfig }),
      ).toThrow('Every template scene must contain a template')
    })

    it('应该拒绝字段无效的模板目录', () => {
      const catalog = {
        scenes: { web: 'Web' },
        templates: {
          web: {
            unsafe: {
              description: '',
              registry: 'file:///private/npm',
              type: 'npm',
              value: '',
            },
          },
        },
      }

      try {
        new CreateTemplate({ catalog: catalog as TemplateConfig })
      } catch (error) {
        expect(error).toMatchObject({ code: 'CREATE_INVALID_CATALOG' })
      }
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
          value: '@eljs/create-plugin-npm-web@0.12.2',
          registry: 'https://registry.npmjs.org/',
          trusted: true,
        },
      })
      expect(mockCreateInstance.run).toHaveBeenCalledWith(projectName)
    })

    it('应该拒绝显式传入的无效场景', async () => {
      createTemplate = new CreateTemplate({
        scene: 'invalid-scene',
        template: 'invalid-template',
      })

      await expect(createTemplate.run(projectName)).rejects.toMatchObject({
        code: 'CREATE_INVALID_OPTIONS',
        details: { scene: 'invalid-scene' },
      })
      expect(mockedPrompts).not.toHaveBeenCalled()
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
          run: vi.fn().mockResolvedValue(undefined),
        }
        mockedCreate.mockImplementation(function MockCreate() {
          return mockCreateInstance as never
        })

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
          run: vi.fn().mockResolvedValue(undefined),
        }
        mockedCreate.mockImplementation(function MockCreate() {
          return mockCreateInstance as never
        })

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

      it('应该拒绝显式提供的无效场景', async () => {
        const createTemplate = new CreateTemplate({
          scene: 'invalid-scene',
        })

        await expect(createTemplate.run('test-project')).rejects.toMatchObject({
          code: 'CREATE_INVALID_OPTIONS',
          details: { scene: 'invalid-scene' },
        })
        expect(mockedPrompts).not.toHaveBeenCalled()
      })
    })

    describe('模板选择测试', () => {
      it('应该使用提供的有效模板', async () => {
        const createTemplate = new CreateTemplate({
          scene: 'npm',
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
        const createTemplate = new CreateTemplate({
          scene: 'npm',
        })

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
          { onCancel: mockedOnCancel },
        )
      })

      it('应该拒绝显式提供的无效模板', async () => {
        const createTemplate = new CreateTemplate({
          scene: 'npm',
          template: 'invalid-template',
        })

        await expect(createTemplate.run('test-project')).rejects.toMatchObject({
          code: 'CREATE_INVALID_OPTIONS',
          details: { scene: 'npm', template: 'invalid-template' },
        })
        expect(mockedPrompts).not.toHaveBeenCalled()
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
          'Expected an application template for scene `npm`',
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
          'Expected an application template for scene `npm`',
        )
      })

      it('应该在找不到对应配置时抛出错误', async () => {
        const createTemplate = new CreateTemplate({
          scene: 'npm',
          template: 'nonexistent-template',
        })

        await expect(createTemplate.run('test-project')).rejects.toThrow(
          'Unknown application template `nonexistent-template` for scene `npm`',
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
        run: vi.fn().mockResolvedValue(undefined),
      }
      mockedCreate.mockImplementation(function MockCreate() {
        return mockCreateInstance as never
      })

      await createTemplate.run('my-project')

      expect(mockedPrompts).toHaveBeenCalledTimes(2)
      expect(mockedCreate).toHaveBeenCalledWith({
        cwd: '/custom/path',
        force: true,
        merge: false,
        template: {
          type: 'npm',
          value: '@eljs/create-plugin-npm-web@0.12.2',
          registry: 'https://registry.npmjs.org/',
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
        scene: 'npm',
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
        scene: 'npm',
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
        scene: 'npm',
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
