import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedClass,
  type MockedFunction,
} from 'vitest'
/**
 * @file packages/create-template cli 模块单元测试
 * @description 测试 cli.ts 命令行接口功能
 */

// 设置静音模式，减少测试输出噪音
const originalConsoleError = console.error
const originalConsoleLog = console.log

beforeAll(() => {
  // 在所有测试开始前静音控制台输出
  console.error = vi.fn()
  console.log = vi.fn()
})

afterAll(() => {
  // 在所有测试结束后恢复控制台输出
  console.error = originalConsoleError
  console.log = originalConsoleLog
})

// 首先进行所有模拟设置
vi.mock('@eljs/utils/file', async () => import('@eljs/utils'))
vi.mock('@eljs/utils/logger', async () => import('@eljs/utils'))
vi.mock('@eljs/utils', () => ({
  chalk: {
    yellow: vi.fn((text: string) => `[yellow]${text}[/yellow]`),
    red: vi.fn((text: string) => `[red]${text}[/red]`),
  },
  createDebugger: vi.fn(() => vi.fn()),
  logger: {
    error: vi.fn(),
    event: vi.fn(),
  },
  readJson: vi.fn(),
}))

const { mockProgram } = vi.hoisted(() => ({
  mockProgram: {
    name: vi.fn().mockReturnThis(),
    description: vi.fn().mockReturnThis(),
    version: vi.fn().mockReturnThis(),
    argument: vi.fn().mockReturnThis(),
    option: vi.fn().mockReturnThis(),
    action: vi.fn().mockReturnThis(),
    showHelpAfterError: vi.fn().mockReturnThis(),
    parseAsync: vi.fn().mockResolvedValue(undefined),
    outputHelp: vi.fn(),
  },
}))

vi.mock('commander', () => ({
  program: mockProgram,
}))

vi.mock('node:path', async importOriginal => {
  const original = await importOriginal<typeof import('node:path')>()
  const join = vi.fn()
  const dirname = vi.fn()

  return {
    ...original,
    default: { ...original, dirname, join },
    dirname,
    join,
  }
})

vi.mock('update-notifier')
vi.mock('@eljs/create', () => ({
  AppError: class AppError extends Error {
    public readonly code: string

    public constructor(message: string, options?: { code?: string }) {
      super(message)
      this.name = 'AppError'
      this.code = options?.code ?? 'CREATE_ERROR'
    }
  },
}))
vi.mock('../src/create')
vi.mock('../src/utils', () => ({
  onCancel: vi.fn(),
}))

// 导入模块
import { createDebugger, readJson } from '@eljs/utils'
import path from 'node:path'
import updateNotifier from 'update-notifier'
import { cli } from '../src/cli'
import { CreateTemplate } from '../src/create'

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
    vi.clearAllMocks()

    // Mock process
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.exit = vi.fn() as any
    process.on = vi.fn()
    process.exitCode = undefined
    process.argv = ['node', 'cli.js']

    // Setup mocks
    ;(readJson as MockedFunction<typeof readJson>).mockResolvedValue(
      mockPackageJson,
    )
    ;(path.join as MockedFunction<typeof path.join>).mockReturnValue(
      '/mock/package.json',
    )
    ;(updateNotifier as MockedFunction<typeof updateNotifier>).mockReturnValue({
      notify: vi.fn(),
      check: vi.fn(),
      fetchInfo: vi.fn(),
    } as unknown as ReturnType<typeof updateNotifier>)

    // Mock CreateTemplate class
    ;(CreateTemplate as MockedClass<typeof CreateTemplate>).mockImplementation(
      function CreateTemplate() {
        return {
          run: vi.fn().mockResolvedValue(undefined),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      },
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
      ;(readJson as MockedFunction<typeof readJson>).mockRejectedValue(error)

      await cli()

      expect(process.exitCode).toBe(1)
    })

    it('成功时应该自然结束而不强制退出进程', async () => {
      await cli()

      expect(process.exit).not.toHaveBeenCalled()
      expect(process.exitCode).toBeUndefined()
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
        CreateTemplate as MockedClass<typeof CreateTemplate>
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
        vi.clearAllMocks()
        await actionHandler(projectName, {})

        expect(CreateTemplate).toHaveBeenCalledWith(expect.objectContaining({}))

        const createInstance = (
          CreateTemplate as MockedClass<typeof CreateTemplate>
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
      const mockDebug = vi.fn()
      ;(
        createDebugger as MockedFunction<typeof createDebugger>
      ).mockReturnValue(mockDebug)

      // 重新执行 cli 以获得新的 debug 实例
      vi.clearAllMocks()
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const newActionHandler = actionCall[0]

      await newActionHandler('debug-project', { force: true })

      expect(mockDebug).toHaveBeenCalledWith('projectName:', 'debug-project')
      expect(mockDebug).toHaveBeenCalledWith('options:%O', { force: true })
    })
  })

  describe('错误帮助配置', () => {
    it('应该使用 Commander 的公开 API 在错误后展示帮助', async () => {
      await cli()

      expect(mockProgram.showHelpAfterError).toHaveBeenCalledWith()
    })
  })

  describe('信号处理验证', () => {
    it('应该把首次 SIGINT 转换为 AbortSignal', async () => {
      const cliPromise = cli()

      // 验证 SIGINT 处理器被注册
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function))

      // 获取注册的处理器并执行
      const signalHandler = (
        process.on as MockedFunction<typeof process.on>
      ).mock.calls.find(call => call[0] === 'SIGINT')?.[1]

      if (typeof signalHandler === 'function') {
        signalHandler('SIGINT')
      }

      await cliPromise
      expect(process.exitCode).toBe(130)
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
        updateNotifier as MockedFunction<typeof updateNotifier>
      ).mock.results[0]
      if (notifierResult && notifierResult.value) {
        expect(notifierResult.value.notify).toHaveBeenCalled()
      }
    })

    it('查询版本时不应该加载更新检查', async () => {
      const originalArgv = process.argv
      process.argv = [process.execPath, 'create-template', '--version']

      try {
        await cli()
      } finally {
        process.argv = originalArgv
      }

      expect(updateNotifier).not.toHaveBeenCalled()
    })

    it('应该处理不同的包信息', async () => {
      const customPkg = {
        name: '@custom/create-template',
        version: '2.0.0',
        description: 'Custom create template tool',
      }
      ;(readJson as MockedFunction<typeof readJson>).mockResolvedValue(
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

      // 验证所有选项都被设置（6个选项）
      expect(mockProgram.option.mock.calls.length).toBe(6)

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
        vi.clearAllMocks()
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
      const mockDebug = vi.fn()
      ;(
        createDebugger as MockedFunction<typeof createDebugger>
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

      expect(CreateTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )

      const createInstance = (
        CreateTemplate as MockedClass<typeof CreateTemplate>
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

      expect(CreateTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          scene: 'npm',
          template: 'template-npm-web',
          force: true,
          cwd: '/workspace',
          signal: expect.any(AbortSignal),
        }),
      )
    })

    it('应该处理合并模式创建流程', async () => {
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      // 模拟: create-template existing-project --merge
      await actionHandler('existing-project', {
        merge: true,
      })

      expect(CreateTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          merge: true,
          signal: expect.any(AbortSignal),
        }),
      )
    })
  })

  describe('CLI 模块导出验证', () => {
    it('应该导出 cli 函数', () => {
      expect(cli).toBeDefined()
      expect(typeof cli).toBe('function')
    })

    it('应该能够重复调用 cli 函数', async () => {
      await cli()
      vi.clearAllMocks()
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
      ;(readJson as MockedFunction<typeof readJson>).mockRejectedValue(error)

      await cli()

      expect(process.exitCode).toBe(1)
    })

    it('应该处理 createDebugger 返回 undefined 的情况', async () => {
      ;(
        createDebugger as MockedFunction<typeof createDebugger>
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
        CreateTemplate as MockedClass<typeof CreateTemplate>
      ).mockImplementation(function CreateTemplate() {
        return {
          run: vi.fn().mockRejectedValue(error),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      })

      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      await expect(actionHandler('failed-project', {})).rejects.toThrow(
        'CreateTemplate failed',
      )
    })
  })
})
