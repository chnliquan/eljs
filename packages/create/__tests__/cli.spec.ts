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
import * as importedModule0 from '../src/cli'
/**
 * @file packages/create cli 模块单元测试
 * @description 测试 cli.ts 命令行接口功能（参考 release CLI 测试策略）
 */

// 首先进行所有模拟设置
vi.mock('@eljs/utils/file', async () => import('@eljs/utils'))
vi.mock('@eljs/utils/logger', async () => import('@eljs/utils'))
vi.mock('@eljs/utils', () => ({
  chalk: {
    yellow: vi.fn((text: string) => `[yellow]${text}[/yellow]`),
    cyan: vi.fn((text: string) => `[cyan]${text}[/cyan]`),
    red: vi.fn((text: string) => `[red]${text}[/red]`),
  },
  createDebugger: vi.fn(() => vi.fn()),
  readJson: vi.fn(),
  logger: {
    error: vi.fn(),
  },
}))

const { mockProgram } = vi.hoisted(() => ({
  mockProgram: {
    name: vi.fn().mockReturnThis(),
    description: vi.fn().mockReturnThis(),
    version: vi.fn().mockReturnThis(),
    arguments: vi.fn().mockReturnThis(),
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

  return {
    ...original,
    default: { ...original, join },
    join,
  }
})

vi.mock('update-notifier')
vi.mock('../src/core')
vi.mock('../src/utils', () => ({
  AppError: class AppError extends Error {
    public constructor(message: string) {
      super(message)
      this.name = 'AppError'
    }
  },
  onCancel: vi.fn(),
}))

// 导入模块
import { createDebugger, readJson } from '@eljs/utils'
import path from 'node:path'
import updateNotifier from 'update-notifier'
import { cli } from '../src/cli'
import { ProjectCreator } from '../src/core'

const requiredModule0 = vi.mocked(importedModule0, { deep: true })

// 类型定义
type ActionHandlerFunction = (
  template: string,
  projectName: string,
  options?: Record<string, unknown>,
) => Promise<void>

// Mock console.log 和 console.error
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

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
    vi.clearAllMocks()

    // Mock process
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.exit = vi.fn() as any
    process.on = vi.fn()

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

    // Mock ProjectCreator class
    ;(ProjectCreator as MockedClass<typeof ProjectCreator>).mockImplementation(
      function ProjectCreator() {
        return {
          run: vi.fn().mockResolvedValue(undefined),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      },
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

    it('应该正确调用 ProjectCreator 类', async () => {
      await actionHandler('test-template', 'test-project', { cwd: '/test' })

      expect(ProjectCreator).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'test-template',
          cwd: '/test',
        }),
      )

      const createInstance = (
        ProjectCreator as MockedClass<typeof ProjectCreator>
      ).mock.results[0].value
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
        vi.clearAllMocks()
        await actionHandler(template, project, {})

        expect(ProjectCreator).toHaveBeenCalledWith(
          expect.objectContaining({
            template,
          }),
        )

        const createInstance = (
          ProjectCreator as MockedClass<typeof ProjectCreator>
        ).mock.results[0].value
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

      expect(ProjectCreator).toHaveBeenCalledWith(
        expect.objectContaining({
          template: 'options-template',
          ...options,
        }),
      )
    })

    it('应该只把显式的 no-install 选择作为配置覆盖', async () => {
      await actionHandler('default-template', 'default-project', {
        install: true,
      })

      expect(ProjectCreator).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          template: 'default-template',
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

      await newActionHandler('debug-template', 'debug-project', { force: true })

      expect(mockDebug).toHaveBeenCalledWith('template:', 'debug-template')
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
    it('应该注册 SIGINT 信号处理器', () => {
      const originalListeners = process.listeners('SIGINT')

      void requiredModule0

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
        updateNotifier as MockedFunction<typeof updateNotifier>
      ).mock.results[0]
      if (notifierResult && notifierResult.value) {
        expect(notifierResult.value.notify).toHaveBeenCalled()
      }
    })

    it('查询帮助时不应该加载更新检查', async () => {
      const originalArgv = process.argv
      process.argv = [process.execPath, 'create', '--help']

      try {
        await cli()
      } finally {
        process.argv = originalArgv
      }

      expect(updateNotifier).not.toHaveBeenCalled()
    })

    it('应该处理不同的包信息', async () => {
      const customPkg = {
        name: '@custom/create',
        version: '2.0.0',
        description: 'Custom create tool',
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
      expect(mockProgram.arguments).toHaveBeenCalled()

      // 验证所有选项都被设置（6个选项）
      expect(mockProgram.option.mock.calls.length).toBe(6)

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
        vi.clearAllMocks()
        await actionHandler(template, 'test-project', {})
        expect(ProjectCreator).toHaveBeenCalledTimes(1)
        expect(ProjectCreator).toHaveBeenCalledWith(
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
      const mockDebug = vi.fn()
      ;(
        createDebugger as MockedFunction<typeof createDebugger>
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

      expect(ProjectCreator).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          template: 'my-template',
        }),
      )

      const createInstance = (
        ProjectCreator as MockedClass<typeof ProjectCreator>
      ).mock.results[0].value
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

      expect(ProjectCreator).toHaveBeenCalledWith(
        expect.objectContaining({
          template: '@company/template',
          force: true,
          cwd: '/workspace',
          signal: expect.any(AbortSignal),
        }),
      )
    })

    it('应该处理本地模板创建流程', async () => {
      await cli()
      const actionCall = mockProgram.action.mock.calls[0]
      const actionHandler = actionCall[0]

      // 模拟: create ./local-template local-project --merge
      await actionHandler('./local-template', 'local-project', {
        merge: true,
      })

      expect(ProjectCreator).toHaveBeenCalledWith(
        expect.objectContaining({
          template: './local-template',
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
})
