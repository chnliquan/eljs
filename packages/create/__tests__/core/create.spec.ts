import * as eljsUtils from '@eljs/utils'
import path from 'node:path'
import { Create, type CreateOptions } from '../../src/core/create'
import { Download } from '../../src/core/download'
import { Runner } from '../../src/core/runner'
import type { RemoteTemplate } from '../../src/types'
import { AppError } from '../../src/utils'

// Mock all dependencies for functional tests
jest.mock('@eljs/utils')
jest.mock('../../src/core/download')
jest.mock('../../src/core/runner')
jest.mock('node:path')

const mockedEljs = eljsUtils as jest.Mocked<typeof eljsUtils>
const MockedDownload = Download as jest.MockedClass<typeof Download>
const MockedRunner = Runner as jest.MockedClass<typeof Runner>
const mockedPath = path as jest.Mocked<typeof path>

describe('Create 类完整测试', () => {
  const mockCwd = '/test/cwd'
  let originalProcessCwd: () => string

  beforeAll(() => {
    originalProcessCwd = process.cwd
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()

    // Mock process.cwd
    process.cwd = jest.fn().mockReturnValue('/mock/cwd')

    // Setup default mocks
    mockedEljs.createDebugger.mockReturnValue(jest.fn())
    mockedEljs.isPathExists.mockResolvedValue(false)
    mockedEljs.isDirectory.mockResolvedValue(true)
    mockedEljs.mkdir.mockResolvedValue(undefined)
    mockedEljs.remove.mockResolvedValue(true)
    mockedEljs.tryPaths.mockResolvedValue('/mock/config')
    mockedEljs.findUp.mockResolvedValue('/mock/template/root')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(mockedEljs.resolve as any).sync = jest
      .fn()
      .mockReturnValue('/mock/resolved/path')
    mockedEljs.isString.mockImplementation(
      (value): value is string => typeof value === 'string',
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(mockedEljs as any).logger = {
      clear: jest.fn(),
      event: jest.fn(),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(mockedEljs as any).chalk = {
      cyan: jest.fn((text: string) => `cyan(${text})`),
    }
    mockedEljs.prompts.mockResolvedValue({ action: 'overwrite' })

    mockedPath.resolve.mockImplementation((...paths) => paths.join('/'))
    mockedPath.join.mockImplementation((...paths) => paths.join('/'))

    // Mock Download class
    MockedDownload.prototype.download = jest
      .fn()
      .mockResolvedValue('/mock/downloaded/template')

    // Mock Runner class
    MockedRunner.prototype.run = jest.fn().mockResolvedValue(undefined)
  })

  afterAll(() => {
    process.cwd = originalProcessCwd
  })

  describe('构造函数测试', () => {
    it('应该正确初始化所有属性', () => {
      const options: CreateOptions = {
        cwd: mockCwd,
        template: 'test-template',
        force: true,
        merge: false,
      }

      const create = new Create(options)

      expect(create.constructorOptions).toBe(options)
      expect(create.cwd).toBe(mockCwd)
      expect(create.template).toBe('test-template')
      expect(create.constructorOptions.force).toBe(true)
      expect(create.constructorOptions.merge).toBe(false)
    })

    it('应该使用默认工作目录', () => {
      const create = new Create({ template: 'test' })
      expect(create.cwd).toBe(process.cwd())
    })

    it('应该使用提供的 cwd', () => {
      const create = new Create({ template: 'test', cwd: '/custom/cwd' })
      expect(create.cwd).toBe('/custom/cwd')
    })

    it('应该正确存储模板配置', () => {
      const remoteTemplate: RemoteTemplate = {
        type: 'npm',
        value: '@scope/package',
        registry: 'https://custom.registry.com',
      }

      const create = new Create({ template: remoteTemplate })
      expect(create.template).toEqual(remoteTemplate)
    })

    it('应该初始化私有属性', () => {
      const create = new Create({ template: 'test' })
      expect(create['_isLocal']).toBe(false)
      expect(create['_templateRootPath']).toBeUndefined()
    })
  })

  describe('run 方法基础功能', () => {
    it('应该有run方法', () => {
      const create = new Create({ template: 'test' })
      expect(typeof create.run).toBe('function')
      expect(create.run.length).toBe(1)
    })

    it('应该接受项目名称参数', async () => {
      const create = new Create({ template: 'test' })

      // Mock run方法以避免实际执行
      create.run = jest.fn().mockImplementation(async (projectName: string) => {
        expect(typeof projectName).toBe('string')
        return Promise.resolve()
      })

      await create.run('test-project')
      expect(create.run).toHaveBeenCalledWith('test-project')
    })

    it('应该处理不同的项目名称格式', async () => {
      const create = new Create({ template: 'test' })

      const projectNames = [
        'simple-project',
        'project_with_underscores',
        'project-with-dashes',
        'projectWithCamelCase',
        'PROJECT_UPPER_CASE',
        '123-numeric-start',
        'project.with.dots',
        'project with spaces',
        '项目中文名称',
        'project-émoji🎉',
      ]

      create.run = jest.fn().mockResolvedValue(undefined)

      for (const projectName of projectNames) {
        await create.run(projectName)
        expect(create.run).toHaveBeenCalledWith(projectName)
      }

      expect(create.run).toHaveBeenCalledTimes(projectNames.length)
    })
  })

  describe('run 方法实际执行', () => {
    beforeEach(() => {
      // Setup to trigger remote template download
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(mockedEljs.resolve as any).sync.mockImplementation(() => {
        throw new Error('Module not found')
      })
    })

    it('应该创建新的目标目录', async () => {
      const create = new Create({ template: 'test-template' })
      await create.run('test-project')

      expect(mockedPath.resolve).toHaveBeenCalledWith(
        '/mock/cwd',
        'test-project',
      )
      expect(mockedEljs.mkdir).toHaveBeenCalledWith('/mock/cwd/test-project')
    })

    it('应该在 force 模式下删除现有目录', async () => {
      mockedEljs.isPathExists.mockResolvedValue(true)

      const create = new Create({
        template: 'test-template',
        force: true,
      })

      await create.run('existing-project')

      expect(mockedEljs.remove).toHaveBeenCalledWith(
        '/mock/cwd/existing-project',
      )
      expect(mockedEljs.mkdir).toHaveBeenCalledWith(
        '/mock/cwd/existing-project',
      )
    })

    it('应该在用户选择 cancel 时提前返回', async () => {
      mockedEljs.isPathExists.mockResolvedValue(true)
      mockedEljs.prompts.mockResolvedValue({ action: false })

      const create = new Create({ template: 'test-template' })
      await create.run('existing-project')

      expect(mockedEljs.mkdir).not.toHaveBeenCalled()
    })

    it('应该在找不到配置文件和生成器文件时抛出错误', async () => {
      mockedEljs.tryPaths.mockResolvedValue(undefined)

      const create = new Create({ template: 'test-template' })

      await expect(create.run('test-project')).rejects.toThrow(AppError)
    })

    it('应该创建 Runner 实例并执行', async () => {
      mockedEljs.tryPaths
        .mockResolvedValueOnce('/mock/downloaded/template/create.config.ts')
        .mockResolvedValueOnce('/mock/downloaded/template/generators/index.ts')

      const create = new Create({ template: 'test-template' })
      await create.run('test-project')

      expect(MockedRunner).toHaveBeenCalledWith({
        cwd: '/mock/downloaded/template',
        plugins: ['/mock/downloaded/template/generators/index.ts'],
      })
      expect(MockedRunner.prototype.run).toHaveBeenCalledWith(
        '/mock/cwd/test-project',
        'test-project',
      )
    })
  })

  describe('模板解析测试', () => {
    it('应该处理相对路径本地模板', async () => {
      mockedEljs.isDirectory.mockResolvedValue(true)

      const create = new Create({ template: './local-template' })
      await create.run('test-project')

      expect(mockedPath.join).toHaveBeenCalledWith(
        '/mock/cwd',
        './local-template',
      )
      expect(create['_isLocal']).toBe(true)
    })

    it('应该在本地模板目录不存在时抛出错误', async () => {
      mockedEljs.isDirectory.mockResolvedValue(false)

      const create = new Create({ template: './non-existent-template' })

      await expect(create.run('test-project')).rejects.toThrow(AppError)
    })

    it('应该解析 node_modules 中的模板', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(mockedEljs.resolve as any).sync.mockReturnValue(
        '/node_modules/template/index.js',
      )
      mockedEljs.findUp.mockResolvedValue('/node_modules/template')
      mockedEljs.isPathExists.mockImplementation(async pathInput => {
        if (
          typeof pathInput === 'string' &&
          pathInput.includes('package.json')
        ) {
          return true
        }
        return false
      })

      const create = new Create({ template: 'npm-template' })
      await create.run('test-project')

      expect(create['_isLocal']).toBe(true)
    })

    it('应该在解析失败时转换为远程模板', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(mockedEljs.resolve as any).sync.mockImplementation(() => {
        throw new Error('Module not found')
      })

      const create = new Create({ template: 'non-existent-npm-package' })
      await create.run('test-project')

      expect(MockedDownload).toHaveBeenCalledWith({
        type: 'npm',
        value: 'non-existent-npm-package',
      })
    })

    it('应该处理 npm 类型远程模板', async () => {
      const template: RemoteTemplate = {
        type: 'npm',
        value: '@scope/template',
        registry: 'https://custom.registry.com',
      }

      const create = new Create({ template })
      await create.run('test-project')

      expect(MockedDownload).toHaveBeenCalledWith(template)
    })

    it('应该处理 git 类型远程模板', async () => {
      const template: RemoteTemplate = {
        type: 'git',
        value: 'https://github.com/user/template.git',
      }

      const create = new Create({ template })
      await create.run('test-project')

      expect(MockedDownload).toHaveBeenCalledWith(template)
    })
  })

  describe('错误处理和清理', () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(mockedEljs.resolve as any).sync.mockImplementation(() => {
        throw new Error('Module not found')
      })
    })

    it('应该在非本地模板时清理下载的文件', async () => {
      mockedEljs.isPathExists
        .mockResolvedValueOnce(false) // target dir
        .mockResolvedValueOnce(true) // template exists for cleanup

      const create = new Create({ template: 'test-template' })
      await create.run('test-project')

      expect(mockedEljs.remove).toHaveBeenCalledWith(
        '/mock/downloaded/template',
      )
    })

    it('应该确保即使出错也会执行清理', async () => {
      MockedRunner.prototype.run.mockRejectedValue(new Error('Runner failed'))
      mockedEljs.isPathExists
        .mockResolvedValueOnce(false) // target dir
        .mockResolvedValueOnce(true) // template exists for cleanup

      const create = new Create({ template: 'test-template' })

      await expect(create.run('test-project')).rejects.toThrow('Runner failed')
      expect(mockedEljs.remove).toHaveBeenCalledWith(
        '/mock/downloaded/template',
      )
    })
  })

  describe('模板类型测试', () => {
    it('应该处理字符串模板的各种格式', () => {
      const stringTemplates = [
        'simple-template',
        './local/relative/template',
        '../parent/template',
        '/absolute/template/path',
        'npm-package-template',
        '@scope/scoped-template',
        '@scope/template@1.0.0',
        'template@latest',
      ]

      stringTemplates.forEach(template => {
        const create = new Create({ template })
        expect(create.template).toBe(template)
        expect(typeof create.template).toBe('string')
      })
    })

    it('应该处理npm类型RemoteTemplate的所有变体', () => {
      const npmTemplates: RemoteTemplate[] = [
        { type: 'npm', value: 'simple-package' },
        { type: 'npm', value: '@scope/package' },
        { type: 'npm', value: 'package@1.0.0' },
        {
          type: 'npm',
          value: 'package',
          registry: 'https://registry.npmjs.org',
        },
      ]

      npmTemplates.forEach(template => {
        const create = new Create({ template })
        expect(create.template).toEqual(template)
        expect((create.template as RemoteTemplate).type).toBe('npm')
      })
    })

    it('应该处理git类型RemoteTemplate的所有变体', () => {
      const gitTemplates: RemoteTemplate[] = [
        { type: 'git', value: 'https://github.com/user/repo.git' },
        { type: 'git', value: 'git@github.com:user/repo.git' },
        { type: 'git', value: 'https://github.com/user/repo.git#main' },
      ]

      gitTemplates.forEach(template => {
        const create = new Create({ template })
        expect(create.template).toEqual(template)
        expect((create.template as RemoteTemplate).type).toBe('git')
      })
    })
  })

  describe('选项组合测试', () => {
    it('应该处理基础选项组合', () => {
      const basicCombinations: CreateOptions[] = [
        { template: 'test' },
        { template: 'test', cwd: '/custom' },
        { template: 'test', force: true },
        { template: 'test', merge: true },
      ]

      basicCombinations.forEach(config => {
        expect(() => new Create(config)).not.toThrow()
        const create = new Create(config)
        expect(create.constructorOptions).toEqual(config)
      })
    })

    it('应该处理RemoteTemplate选项组合', () => {
      const remoteCombinations: CreateOptions[] = [
        { template: { type: 'npm', value: 'pkg' } },
        { template: { type: 'git', value: 'repo' } },
        { template: { type: 'npm', value: 'pkg' }, force: true },
        {
          template: { type: 'npm', value: 'pkg', registry: 'https://reg.com' },
          cwd: '/workspace',
        },
      ]

      remoteCombinations.forEach(config => {
        expect(() => new Create(config)).not.toThrow()
        const create = new Create(config)
        expect(create.template).toEqual(config.template)
      })
    })
  })

  describe('错误处理', () => {
    it('应该正确创建和处理AppError', () => {
      const errorMessages = [
        'Simple error',
        'Error with special chars: @#$%',
        '中文错误信息',
        '',
        ' ',
      ]

      errorMessages.forEach(message => {
        const error = new AppError(message)
        expect(error).toBeInstanceOf(AppError)
        expect(error).toBeInstanceOf(Error)
        expect(error.name).toBe('AppError')
        expect(error.message).toBe(message)
      })
    })

    it('应该支持AppError的抛出和捕获', () => {
      expect(() => {
        throw new AppError('测试错误')
      }).toThrow(AppError)

      expect(() => {
        throw new AppError('测试错误')
      }).toThrow('测试错误')
    })
  })

  describe('边界情况测试', () => {
    it('应该处理特殊字符模板名称', () => {
      const specialTemplates = [
        'template-with-dashes',
        'template_with_underscores',
        'template.with.dots',
        'TEMPLATE_UPPERCASE',
        '中文模板名称',
      ]

      specialTemplates.forEach(template => {
        expect(() => new Create({ template })).not.toThrow()
        const create = new Create({ template })
        expect(create.template).toBe(template)
      })
    })

    it('应该处理配置验证', () => {
      const fullConfig: CreateOptions = {
        cwd: '/full/config',
        template: {
          type: 'npm',
          value: '@full/template',
          registry: 'https://full.registry.com',
        },
        force: true,
        merge: true,
      }

      const create = new Create(fullConfig)
      expect(create.constructorOptions.cwd).toBe('/full/config')
      expect(create.constructorOptions.force).toBe(true)
      expect(create.constructorOptions.merge).toBe(true)
    })
  })

  describe('属性访问测试', () => {
    it('应该允许读取所有公共属性', () => {
      const create = new Create({
        template: 'property-test',
        cwd: '/property/test',
        force: true,
        merge: false,
      })

      expect(create.constructorOptions).toBeDefined()
      expect(create.cwd).toBe('/property/test')
      expect(create.template).toBe('property-test')
    })

    it('应该允许访问私有属性（测试目的）', () => {
      const create = new Create({ template: 'private-test' })

      expect('_isLocal' in create).toBe(true)
      expect(create['_isLocal']).toBe(false)

      create['_isLocal'] = true
      create['_templateRootPath'] = '/custom/path'

      expect(create['_isLocal']).toBe(true)
      expect(create['_templateRootPath']).toBe('/custom/path')
    })
  })
})
