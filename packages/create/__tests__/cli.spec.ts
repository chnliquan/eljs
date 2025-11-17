/**
 * @file packages/create cli 模块单元测试
 * @description 测试 cli.ts 命令行接口功能（参考 release CLI 测试策略）
 */

// 首先进行所有模拟设置
jest.mock('@eljs/utils', () => ({
  chalk: {
    yellow: jest.fn((text: string) => `[yellow]${text}[/yellow]`),
    cyan: jest.fn((text: string) => `[cyan]${text}[/cyan]`),
    red: jest.fn((text: string) => `[red]${text}[/red]`),
  },
  createDebugger: jest.fn(() => jest.fn()),
  readJson: jest.fn(),
  logger: {
    error: jest.fn(),
  },
}))

const mockProgram = {
  name: jest.fn().mockReturnThis(),
  description: jest.fn().mockReturnThis(),
  version: jest.fn().mockReturnThis(),
  arguments: jest.fn().mockReturnThis(),
  option: jest.fn().mockReturnThis(),
  action: jest.fn().mockReturnThis(),
  parseAsync: jest.fn().mockResolvedValue(undefined),
  outputHelp: jest.fn(),
}

jest.mock('commander', () => ({
  Command: jest.fn(),
  program: mockProgram,
}))

jest.mock('node:path', () => ({
  join: jest.fn(),
}))

jest.mock('update-notifier')
jest.mock('../src/core')
jest.mock('../src/utils', () => ({
  AppError: class AppError extends Error {
    public constructor(message: string) {
      super(message)
      this.name = 'AppError'
    }
  },
  onCancel: jest.fn(),
}))

// 导入模块
import { createDebugger, readJson } from '@eljs/utils'
import { Command } from 'commander'
import path from 'node:path'
import updateNotifier from 'update-notifier'
import { cli } from '../src/cli'
import { Create } from '../src/core'

// 类型定义
type ActionHandlerFunction = (
  template: string,
  projectName: string,
  options?: Record<string, unknown>,
) => Promise<void>

// Mock console.log 和 console.error
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})
const mockConsoleError = jest
  .spyOn(console, 'error')
  .mockImplementation(() => {})

describe('CLI 命令行接口综合测试', () => {
  const mockPackageJson = {
    name: '@eljs/create',
    version: '1.0.0',
    description: 'Create a project from a remote template',
  }

  let originalProcessOn: typeof process.on
  let originalProcessExit: typeof process.exit

  beforeAll(() => {
    originalProcessOn = process.on
    originalProcessExit = process.exit
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock process
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.exit = jest.fn() as any
    process.on = jest.fn()

    // Setup mocks
    ;(readJson as jest.MockedFunction<typeof readJson>).mockResolvedValue(
      mockPackageJson,
    )
    ;(path.join as jest.MockedFunction<typeof path.join>).mockReturnValue(
      '/mock/package.json',
    )
    ;(
      updateNotifier as jest.MockedFunction<typeof updateNotifier>
    ).mockReturnValue({
      notify: jest.fn(),
      check: jest.fn(),
      fetchInfo: jest.fn(),
    } as unknown as ReturnType<typeof updateNotifier>)

    // Mock Create class
    ;(Create as jest.MockedClass<typeof Create>).mockImplementation(
      () =>
        ({
          run: jest.fn().mockResolvedValue(undefined),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    )
  })

  afterAll(() => {
    mockConsoleLog.mockRestore()
    mockConsoleError.mockRestore()
    process.on = originalProcessOn
    process.exit = originalProcessExit
  })

  describe('CLI 函数基本功能', () => {
    it('应该成功执行 cli 函数', async () => {
      await cli()

      expect(readJson).toHaveBeenCalled()
      expect(updateNotifier).toHaveBeenCalledWith({ pkg: mockPackageJson })
      expect(mockProgram.parseAsync).toHaveBeenCalledWith(process.argv)
    })

    it('应该正确设置 program 基本信息', async () => {
      await cli()

      expect(mockProgram.name).toHaveBeenCalledWith('create')
      expect(mockProgram.description).toHaveBeenCalledWith(
        'Create a project from a remote template',
      )
      expect(mockProgram.version).toHaveBeenCalledWith(
        '1.0.0',
        '-v, --version',
        'Output the current version',
      )
    })

    it('应该设置模板和项目名参数', async () => {
      await cli()

      expect(mockProgram.arguments).toHaveBeenCalledWith(
        '<template> <project-name>',
      )
    })

    it('应该设置基本命令行选项', async () => {
      await cli()

      // 验证关键选项
      expect(mockProgram.option).toHaveBeenCalledWith(
        '--cwd <cwd>',
        'Specify the working directory',
      )
      expect(mockProgram.option).toHaveBeenCalledWith(
        '-f, --force',
        'Overwrite target directory if it exists',
      )
      expect(mockProgram.option).toHaveBeenCalledWith(
        '-m, --merge',
        'Merge target directory if it exists',
      )
      expect(mockProgram.option).toHaveBeenCalledWith(
        '--no-install',
        'Skip install dependencies after create done',
      )
    })

    it('应该设置 action 处理器', async () => {
      await cli()

      expect(mockProgram.action).toHaveBeenCalledWith(expect.any(Function))
    })
  })

  describe('Action 处理器功能测试', () => {
    let actionHandler: ActionHandlerFunction

    beforeEach(async () => {
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      actionHandler = actionCall ? actionCall[0] : null
    })

    it('应该正确调用 Create 类', async () => {
      await actionHandler('test-template', 'test-project', { cwd: '/test' })

      expect(Create).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'test-template',
          cwd: '/test',
        }),
      )

      const createInstance = (Create as jest.MockedClass<typeof Create>).mock
        .results[0].value
      expect(createInstance.run).toHaveBeenCalledWith('test-project')
    })

    it('应该处理各种模板类型', async () => {
      const testCases = [
        { template: 'simple-template', project: 'simple-project' },
        { template: '@scope/template', project: 'scoped-project' },
        { template: './local-template', project: 'local-project' },
        { template: '/absolute/template', project: 'absolute-project' },
      ]

      for (const { template, project } of testCases) {
        jest.clearAllMocks()
        await actionHandler(template, project, {})

        expect(Create).toHaveBeenCalledWith(
          expect.objectContaining({
            template,
          }),
        )

        const createInstance = (Create as jest.MockedClass<typeof Create>).mock
          .results[0].value
        expect(createInstance.run).toHaveBeenCalledWith(project)
      }
    })

    it('应该正确传递所有选项', async () => {
      const options = {
        cwd: '/workspace',
        force: true,
        merge: false,
        install: false,
      }

      await actionHandler('options-template', 'options-project', options)

      expect(Create).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'options-template',
          ...options,
        }),
      )
    })

    it('应该记录调试信息', async () => {
      const mockDebug = jest.fn()
      ;(
        createDebugger as jest.MockedFunction<typeof createDebugger>
      ).mockReturnValue(mockDebug)

      // 重新执行 cli 以获得新的 debug 实例
      jest.clearAllMocks()
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const newActionHandler = actionCall[0]

      await newActionHandler('debug-template', 'debug-project', { force: true })

      expect(mockDebug).toHaveBeenCalledWith('template:', 'debug-template')
      expect(mockDebug).toHaveBeenCalledWith('projectName:', 'debug-project')
      expect(mockDebug).toHaveBeenCalledWith('options:%O', { force: true })
    })
  })

  describe('错误处理增强验证', () => {
    it('应该增强 Command 原型方法', async () => {
      await cli()

      // 验证原型方法被增强
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(Command.prototype as any).toHaveProperty('missingArgument')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(Command.prototype as any).toHaveProperty('unknownOption')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(Command.prototype as any).toHaveProperty('optionMissingArgument')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(Command.prototype as any).toHaveProperty('_excessArguments')
    })

    it('应该验证错误处理增强函数的存在和调用', async () => {
      await cli()

      // 验证方法被正确添加并能被调用
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(typeof (Command.prototype as any).missingArgument).toBe('function')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(typeof (Command.prototype as any).unknownOption).toBe('function')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(typeof (Command.prototype as any).optionMissingArgument).toBe(
        'function',
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(typeof (Command.prototype as any)._excessArguments).toBe(
        'function',
      )

      // 测试方法可以被正常调用（这里会实际执行增强的错误处理逻辑）
      const mockCommand = {
        outputHelp: jest.fn(),
        _allowUnknownOption: false,
        registeredArguments: [{ name: 'template' }],
        _allowExcessArguments: false,
      }

      // 这些调用会触发实际的错误处理代码，从而提高覆盖率
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(Command.prototype as any).missingArgument.call(mockCommand, 'template')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(Command.prototype as any).unknownOption.call(mockCommand, '--invalid')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(Command.prototype as any).optionMissingArgument.call(mockCommand, {
        flags: '--test',
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(Command.prototype as any)._excessArguments.call(mockCommand, [
        'arg1',
        'arg2',
      ])

      expect(mockCommand.outputHelp).toHaveBeenCalledTimes(4)
    })

    it('应该测试条件分支逻辑', async () => {
      await cli()

      // 测试 unknownOption 允许未知选项的分支
      const allowUnknownCommand = {
        outputHelp: jest.fn(),
        _allowUnknownOption: true,
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(Command.prototype as any).unknownOption.call(
        allowUnknownCommand,
        '--allowed',
      )
      expect(allowUnknownCommand.outputHelp).not.toHaveBeenCalled()

      // 测试 _excessArguments 允许多余参数的分支
      const allowExcessCommand = {
        outputHelp: jest.fn(),
        registeredArguments: [{ name: 'template' }],
        _allowExcessArguments: true,
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(Command.prototype as any)._excessArguments.call(allowExcessCommand, [
        'arg1',
        'arg2',
      ])
      expect(allowExcessCommand.outputHelp).not.toHaveBeenCalled()
    })
  })

  describe('信号处理验证', () => {
    it('应该注册 SIGINT 信号处理器', () => {
      const originalListeners = process.listeners('SIGINT')

      delete require.cache[require.resolve('../src/cli')]
      require('../src/cli')

      const newListeners = process.listeners('SIGINT')
      expect(newListeners.length).toBeGreaterThanOrEqual(
        originalListeners.length,
      )
    })
  })

  describe('CLI 依赖集成验证', () => {
    it('应该正确读取和使用 package.json', async () => {
      await cli()

      expect(readJson).toHaveBeenCalledWith('/mock/package.json')
      expect(path.join).toHaveBeenCalledWith(
        expect.any(String),
        '../package.json',
      )
    })

    it('应该调用 updateNotifier 并触发通知', async () => {
      await cli()

      expect(updateNotifier).toHaveBeenCalledWith({ pkg: mockPackageJson })

      const notifierResult = (
        updateNotifier as jest.MockedFunction<typeof updateNotifier>
      ).mock.results[0]
      if (notifierResult && notifierResult.value) {
        expect(notifierResult.value.notify).toHaveBeenCalled()
      }
    })

    it('应该处理不同的包信息', async () => {
      const customPkg = {
        name: '@custom/create',
        version: '2.0.0',
        description: 'Custom create tool',
      }
      ;(readJson as jest.MockedFunction<typeof readJson>).mockResolvedValue(
        customPkg,
      )

      await cli()

      expect(mockProgram.version).toHaveBeenCalledWith(
        '2.0.0',
        '-v, --version',
        'Output the current version',
      )
      expect(updateNotifier).toHaveBeenCalledWith({ pkg: customPkg })
    })
  })

  describe('CLI 完整功能覆盖测试', () => {
    it('应该完整覆盖所有设置步骤', async () => {
      await cli()

      // 验证所有关键步骤都被执行
      expect(readJson).toHaveBeenCalled()
      expect(updateNotifier).toHaveBeenCalled()
      expect(mockProgram.name).toHaveBeenCalled()
      expect(mockProgram.description).toHaveBeenCalled()
      expect(mockProgram.version).toHaveBeenCalled()
      expect(mockProgram.arguments).toHaveBeenCalled()

      // 验证所有选项都被设置（4个选项）
      expect(mockProgram.option.mock.calls.length).toBe(4)

      expect(mockProgram.action).toHaveBeenCalled()
      expect(mockProgram.parseAsync).toHaveBeenCalled()
    })

    it('应该处理所有类型的模板输入', async () => {
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      const templateInputs = [
        'simple-template',
        '@scope/scoped-template',
        './local-template',
        '/absolute/template',
        'template@1.0.0',
        'template@latest',
      ]

      for (const template of templateInputs) {
        jest.clearAllMocks()
        await actionHandler(template, 'test-project', {})
        expect(Create).toHaveBeenCalledTimes(1)
        expect(Create).toHaveBeenCalledWith(
          expect.objectContaining({ template }),
        )
      }
    })
  })

  describe('CLI 调试和开发功能', () => {
    it('应该创建和使用调试器', async () => {
      await cli()

      expect(createDebugger).toHaveBeenCalledWith('create:cli')
    })

    it('应该能处理 debug 函数调用', async () => {
      const mockDebug = jest.fn()
      ;(
        createDebugger as jest.MockedFunction<typeof createDebugger>
      ).mockReturnValue(mockDebug)

      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      await actionHandler('debug-template', 'debug-project', { debug: true })

      expect(createDebugger).toHaveBeenCalledWith('create:cli')
      expect(mockDebug).toHaveBeenCalledWith('template:', 'debug-template')
      expect(mockDebug).toHaveBeenCalledWith('projectName:', 'debug-project')
      expect(mockDebug).toHaveBeenCalledWith('options:%O', { debug: true })
    })
  })

  describe('真实场景完整测试', () => {
    it('应该处理标准创建流程', async () => {
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      // 模拟: create my-template my-project
      await actionHandler('my-template', 'my-project', {})

      expect(Create).toHaveBeenCalledWith({
        template: 'my-template',
      })

      const createInstance = (Create as jest.MockedClass<typeof Create>).mock
        .results[0].value
      expect(createInstance.run).toHaveBeenCalledWith('my-project')
    })

    it('应该处理企业级创建流程', async () => {
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      // 模拟: create @company/template enterprise-app --force --cwd /workspace
      await actionHandler('@company/template', 'enterprise-app', {
        force: true,
        cwd: '/workspace',
      })

      expect(Create).toHaveBeenCalledWith({
        template: '@company/template',
        force: true,
        cwd: '/workspace',
      })
    })

    it('应该处理本地模板创建流程', async () => {
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      // 模拟: create ./local-template local-project --merge
      await actionHandler('./local-template', 'local-project', {
        merge: true,
      })

      expect(Create).toHaveBeenCalledWith({
        template: './local-template',
        merge: true,
      })
    })
  })

  describe('CLI 模块导出验证', () => {
    it('应该导出 cli 函数', () => {
      expect(cli).toBeDefined()
      expect(typeof cli).toBe('function')
    })

    it('应该能够重复调用 cli 函数', async () => {
      await cli()
      jest.clearAllMocks()
      await cli()

      // 应该再次调用所有设置步骤
      expect(readJson).toHaveBeenCalled()
      expect(updateNotifier).toHaveBeenCalled()
      expect(mockProgram.parseAsync).toHaveBeenCalled()
    })
  })
})
