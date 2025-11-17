/**
 * @file packages/create-template cli 模块单元测试
 * @description 测试 cli.ts 命令行接口功能
 */

// 设置静音模式，减少测试输出噪音
const originalConsoleError = console.error
const originalConsoleLog = console.log

beforeAll(() => {
  // 在所有测试开始前静音控制台输出
  console.error = jest.fn()
  console.log = jest.fn()
})

afterAll(() => {
  // 在所有测试结束后恢复控制台输出
  console.error = originalConsoleError
  console.log = originalConsoleLog
})

// 首先进行所有模拟设置
jest.mock('@eljs/utils', () => ({
  chalk: {
    yellow: jest.fn((text: string) => `[yellow]${text}[/yellow]`),
    red: jest.fn((text: string) => `[red]${text}[/red]`),
  },
  createDebugger: jest.fn(() => jest.fn()),
  readJson: jest.fn(),
}))

const mockProgram = {
  name: jest.fn().mockReturnThis(),
  description: jest.fn().mockReturnThis(),
  version: jest.fn().mockReturnThis(),
  argument: jest.fn().mockReturnThis(),
  option: jest.fn().mockReturnThis(),
  action: jest.fn().mockReturnThis(),
  parseAsync: jest.fn().mockResolvedValue(undefined),
  outputHelp: jest.fn(),
}

jest.mock('commander', () => ({
  Command: jest.fn().mockImplementation(() => ({
    outputHelp: jest.fn(),
  })),
  program: mockProgram,
}))

jest.mock('node:path', () => ({
  join: jest.fn(),
  dirname: jest.fn(),
}))

jest.mock('update-notifier')
jest.mock('@eljs/create', () => ({}))
jest.mock('../src/create')
jest.mock('../src/utils', () => ({
  onCancel: jest.fn(),
}))

// 导入模块
import { createDebugger, readJson } from '@eljs/utils'
import { Command } from 'commander'
import path from 'node:path'
import updateNotifier from 'update-notifier'
import { cli } from '../src/cli'
import { CreateTemplate } from '../src/create'
import { onCancel } from '../src/utils'

// 类型定义
type ActionHandlerFunction = (
  projectName: string,
  options?: Record<string, unknown>,
) => Promise<void>

describe('CLI 命令行接口综合测试', () => {
  const mockPackageJson = {
    name: '@eljs/create-template',
    version: '1.3.1',
    description: 'Create a new project powered by @eljs/create',
  }

  let originalProcessOn: typeof process.on
  let originalProcessExit: typeof process.exit
  let originalProcessArgv: typeof process.argv

  beforeAll(() => {
    originalProcessOn = process.on
    originalProcessExit = process.exit
    originalProcessArgv = process.argv
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock process
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.exit = jest.fn() as any
    process.on = jest.fn()
    process.argv = ['node', 'cli.js']

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

    // Mock CreateTemplate class
    ;(
      CreateTemplate as jest.MockedClass<typeof CreateTemplate>
    ).mockImplementation(
      () =>
        ({
          run: jest.fn().mockResolvedValue(undefined),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
    )
  })

  afterAll(() => {
    process.on = originalProcessOn
    process.exit = originalProcessExit
    process.argv = originalProcessArgv
  })

  describe('cli 函数基本功能', () => {
    it('应该成功执行 cli 函数', async () => {
      await cli()

      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    })

    it('应该处理 main 函数中的错误', async () => {
      const error = new Error('Test error')
      ;(readJson as jest.MockedFunction<typeof readJson>).mockRejectedValue(
        error,
      )

      await cli()

      expect(process.exit).toHaveBeenCalledWith(1)
    })

    it('应该在成功时退出进程', async () => {
      await cli()

      expect(process.exit).toHaveBeenCalledWith(0)
    })
  })

  describe('program 配置验证', () => {
    it('应该正确设置 program 基本信息', async () => {
      await cli()

      expect(mockProgram.name).toHaveBeenCalledWith('create-template')
      expect(mockProgram.description).toHaveBeenCalledWith(
        'Create a new project powered by @eljs/create',
      )
      expect(mockProgram.version).toHaveBeenCalledWith(
        '1.3.1',
        '-v, --version',
        'Output the current version',
      )
    })

    it('应该设置项目名参数', async () => {
      await cli()

      expect(mockProgram.argument).toHaveBeenCalledWith(
        '<project-name>',
        'Project name',
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
        '-s, --scene <scene>',
        'Specify a application scene',
      )
      expect(mockProgram.option).toHaveBeenCalledWith(
        '-t, --template <template>',
        'Specify a application template',
      )
      expect(mockProgram.option).toHaveBeenCalledWith(
        '-f, --force',
        'Overwrite target directory if it exists',
      )
      expect(mockProgram.option).toHaveBeenCalledWith(
        '-m, --merge',
        'Merge target directory if it exists',
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

    it('应该正确调用 CreateTemplate 类', async () => {
      await actionHandler('test-project', { cwd: '/test' })

      expect(CreateTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: '/test',
        }),
      )

      const createInstance = (
        CreateTemplate as jest.MockedClass<typeof CreateTemplate>
      ).mock.results[0].value
      expect(createInstance.run).toHaveBeenCalledWith('test-project')
    })

    it('应该处理各种项目名称类型', async () => {
      const testCases = [
        'simple-project',
        'my-awesome-project',
        'project123',
        'project_name',
      ]

      for (const projectName of testCases) {
        jest.clearAllMocks()
        await actionHandler(projectName, {})

        expect(CreateTemplate).toHaveBeenCalledWith(expect.objectContaining({}))

        const createInstance = (
          CreateTemplate as jest.MockedClass<typeof CreateTemplate>
        ).mock.results[0].value
        expect(createInstance.run).toHaveBeenCalledWith(projectName)
      }
    })

    it('应该正确传递所有选项', async () => {
      const options = {
        cwd: '/workspace',
        scene: 'npm',
        template: 'template-npm-web',
        force: true,
        merge: false,
      }

      await actionHandler('options-project', options)

      expect(CreateTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
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

      await newActionHandler('debug-project', { force: true })

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
        registeredArguments: [{ name: 'project-name' }],
        _allowExcessArguments: false,
      }

      // 这些调用会触发实际的错误处理代码，从而提高覆盖率
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(Command.prototype as any).missingArgument.call(
        mockCommand,
        'project-name',
      )
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
        registeredArguments: [{ name: 'project-name' }],
        _allowExcessArguments: true,
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(Command.prototype as any)._excessArguments.call(allowExcessCommand, [
        'arg1',
        'arg2',
      ])
      expect(allowExcessCommand.outputHelp).not.toHaveBeenCalled()
    })

    it('应该测试单参数情况下的错误信息', async () => {
      await cli()

      const mockCommand = {
        outputHelp: jest.fn(),
        _allowUnknownOption: false,
        registeredArguments: [{ name: 'single-arg' }],
        _allowExcessArguments: false,
      }

      // 测试单参数情况（expected = 1, s = ''）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(Command.prototype as any)._excessArguments.call(mockCommand, [
        'arg1',
        'arg2',
      ])

      expect(mockCommand.outputHelp).toHaveBeenCalled()
    })

    it('应该测试带 flag 参数的选项错误', async () => {
      await cli()

      const mockCommand = {
        outputHelp: jest.fn(),
      }

      // 测试带 flag 的选项错误
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(Command.prototype as any).optionMissingArgument.call(
        mockCommand,
        {
          flags: '--test',
        },
        '--flag',
      )

      expect(mockCommand.outputHelp).toHaveBeenCalled()
    })
  })

  describe('信号处理验证', () => {
    it('应该处理 SIGINT 信号', () => {
      const mockOnCancel = jest.fn()
      ;(onCancel as jest.MockedFunction<typeof onCancel>).mockImplementation(
        mockOnCancel,
      )

      cli()

      // 验证 SIGINT 处理器被注册
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function))

      // 获取注册的处理器并执行
      const signalHandler = (
        process.on as jest.MockedFunction<typeof process.on>
      ).mock.calls.find(call => call[0] === 'SIGINT')?.[1]

      if (typeof signalHandler === 'function') {
        signalHandler('SIGINT')
        expect(onCancel).toHaveBeenCalled()
      }
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
        name: '@custom/create-template',
        version: '2.0.0',
        description: 'Custom create template tool',
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
      expect(mockProgram.argument).toHaveBeenCalled()

      // 验证所有选项都被设置（5个选项）
      expect(mockProgram.option.mock.calls.length).toBe(5)

      expect(mockProgram.action).toHaveBeenCalled()
      expect(mockProgram.parseAsync).toHaveBeenCalled()
    })

    it('应该处理所有类型的项目名输入', async () => {
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      const projectNames = [
        'simple-project',
        'my-awesome-app',
        'project123',
        'vue-app',
        'react-app',
        'node-server',
      ]

      for (const projectName of projectNames) {
        jest.clearAllMocks()
        await actionHandler(projectName, {})
        expect(CreateTemplate).toHaveBeenCalledTimes(1)
        expect(CreateTemplate).toHaveBeenCalledWith(expect.any(Object))
      }
    })
  })

  describe('CLI 调试和开发功能', () => {
    it('应该创建和使用调试器', async () => {
      await cli()

      expect(createDebugger).toHaveBeenCalledWith('create-template:cli')
    })

    it('应该能处理 debug 函数调用', async () => {
      const mockDebug = jest.fn()
      ;(
        createDebugger as jest.MockedFunction<typeof createDebugger>
      ).mockReturnValue(mockDebug)

      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      await actionHandler('debug-project', { debug: true })

      expect(createDebugger).toHaveBeenCalledWith('create-template:cli')
      expect(mockDebug).toHaveBeenCalledWith('projectName:', 'debug-project')
      expect(mockDebug).toHaveBeenCalledWith('options:%O', { debug: true })
    })
  })

  describe('真实场景完整测试', () => {
    it('应该处理标准创建流程', async () => {
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      // 模拟: create-template my-project
      await actionHandler('my-project', {})

      expect(CreateTemplate).toHaveBeenCalledWith({})

      const createInstance = (
        CreateTemplate as jest.MockedClass<typeof CreateTemplate>
      ).mock.results[0].value
      expect(createInstance.run).toHaveBeenCalledWith('my-project')
    })

    it('应该处理带场景和模板的创建流程', async () => {
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      // 模拟: create-template enterprise-app --scene npm --template template-npm-web --force --cwd /workspace
      await actionHandler('enterprise-app', {
        scene: 'npm',
        template: 'template-npm-web',
        force: true,
        cwd: '/workspace',
      })

      expect(CreateTemplate).toHaveBeenCalledWith({
        scene: 'npm',
        template: 'template-npm-web',
        force: true,
        cwd: '/workspace',
      })
    })

    it('应该处理合并模式创建流程', async () => {
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      // 模拟: create-template existing-project --merge
      await actionHandler('existing-project', {
        merge: true,
      })

      expect(CreateTemplate).toHaveBeenCalledWith({
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

  describe('CLI 错误处理和边界情况', () => {
    it('应该处理 readJson 失败的情况', async () => {
      const error = new Error('Failed to read package.json')
      ;(readJson as jest.MockedFunction<typeof readJson>).mockRejectedValue(
        error,
      )

      await cli()

      expect(process.exit).toHaveBeenCalledWith(1)
    })

    it('应该处理 createDebugger 返回 undefined 的情况', async () => {
      ;(
        createDebugger as jest.MockedFunction<typeof createDebugger>
      ).mockReturnValue(undefined)

      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      // 应该不会抛出错误
      await expect(actionHandler('test-project', {})).resolves.not.toThrow()
    })

    it('应该处理 CreateTemplate 运行失败的情况', async () => {
      const error = new Error('CreateTemplate failed')
      ;(
        CreateTemplate as jest.MockedClass<typeof CreateTemplate>
      ).mockImplementation(
        () =>
          ({
            run: jest.fn().mockRejectedValue(error),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      )

      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      await expect(actionHandler('failed-project', {})).rejects.toThrow(
        'CreateTemplate failed',
      )
    })
  })
})
