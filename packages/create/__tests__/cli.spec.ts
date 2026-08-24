import { createDebugger, logger, readJson } from '@eljs/utils'
import updateNotifier from 'update-notifier'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedClass,
  type MockedFunction,
} from 'vitest'

import { cli } from '../src/cli'
import { ProjectCreator } from '../src/core'
import { AppError } from '../src/errors'

vi.mock('@eljs/utils/file', async () => import('@eljs/utils'))
vi.mock('@eljs/utils/logger', async () => import('@eljs/utils'))
vi.mock('@eljs/utils', () => ({
  createDebugger: vi.fn(),
  logger: {
    error: vi.fn(),
    event: vi.fn(),
  },
  readJson: vi.fn(),
}))
vi.mock('update-notifier')
vi.mock('../src/core')

describe('create CLI', () => {
  const originalArgv = process.argv
  const mockedCreateDebugger = createDebugger as MockedFunction<
    typeof createDebugger
  >
  const mockedProjectCreator = ProjectCreator as MockedClass<
    typeof ProjectCreator
  >
  const mockedReadJson = readJson as MockedFunction<typeof readJson>
  const mockedUpdateNotifier = updateNotifier as MockedFunction<
    typeof updateNotifier
  >
  const debug = vi.fn()
  const notify = vi.fn()
  const run = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = undefined
    process.argv = ['node', 'create', 'template-package', 'test-project']
    debug.mockReset()
    notify.mockReset()
    run.mockReset().mockResolvedValue(undefined)
    mockedCreateDebugger.mockReturnValue(debug)
    mockedReadJson.mockResolvedValue({
      name: '@eljs/create',
      version: '2.0.0-alpha.0',
    })
    mockedUpdateNotifier.mockReturnValue({
      notify,
    } as unknown as ReturnType<typeof updateNotifier>)
    mockedProjectCreator.mockImplementation(function MockProjectCreator() {
      return { run } as never
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    process.argv = originalArgv
    process.exitCode = undefined
    vi.restoreAllMocks()
  })

  it('使用真实 Commander 解析参数并运行创建器', async () => {
    process.argv = [
      'node',
      'create',
      '@scope/template',
      'orders-service',
      '--cwd',
      '/workspace',
      '--force',
      '--no-install',
      '--yes',
      '--allow-template-scripts',
    ]

    await cli()

    expect(mockedProjectCreator).toHaveBeenCalledWith({
      allowTemplateScripts: true,
      cwd: '/workspace',
      force: true,
      install: false,
      signal: expect.any(AbortSignal),
      template: '@scope/template',
      yes: true,
    })
    expect(run).toHaveBeenCalledWith('orders-service')
    expect(process.exitCode).toBeUndefined()
  })

  it('未显式禁用安装时不覆盖模板配置', async () => {
    await cli()

    const options = mockedProjectCreator.mock.calls[0]?.[0]
    expect(options).toBeDefined()
    expect(options && 'install' in options).toBe(false)
  })

  it('每次调用使用独立命令实例', async () => {
    await cli()
    await cli()

    expect(mockedProjectCreator).toHaveBeenCalledTimes(2)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('更新提示在后台执行', async () => {
    await cli()

    await vi.waitFor(() => {
      expect(mockedUpdateNotifier).toHaveBeenCalledWith({
        pkg: { name: '@eljs/create', version: '2.0.0-alpha.0' },
      })
      expect(notify).toHaveBeenCalledOnce()
    })
  })

  it('更新提示失败不会阻止创建主路径', async () => {
    const error = new Error('Update notifier failed')
    mockedUpdateNotifier.mockImplementation(() => {
      throw error
    })

    await cli()

    await vi.waitFor(() =>
      expect(debug).toHaveBeenCalledWith(
        'update notification failed:%O',
        error,
      ),
    )
    expect(run).toHaveBeenCalledWith('test-project')
    expect(process.exitCode).toBeUndefined()
  })

  it('首次信号取消流程并在结束后移除监听器', async () => {
    const previousListeners = new Set(process.listeners('SIGINT'))
    let signalHandler: NodeJS.SignalsListener | undefined
    run.mockImplementation(async () => {
      signalHandler = process
        .listeners('SIGINT')
        .find(listener => !previousListeners.has(listener))
      ;(signalHandler as (signal: NodeJS.Signals) => void)('SIGINT')
    })

    await cli()

    expect(signalHandler).toBeTypeOf('function')
    expect(logger.event).toHaveBeenCalledWith('Cancelling create after SIGINT')
    expect(process.exitCode).toBe(130)
    expect(process.listeners('SIGINT')).not.toContain(signalHandler)
  })

  it('信号日志失败时仍然取消流程', async () => {
    const previousListeners = new Set(process.listeners('SIGINT'))
    vi.mocked(logger.event).mockImplementationOnce(() => {
      throw new Error('Logger failed')
    })
    run.mockImplementation(async () => {
      const signalHandler = process
        .listeners('SIGINT')
        .find(listener => !previousListeners.has(listener))
      ;(signalHandler as (signal: NodeJS.Signals) => void)('SIGINT')
    })

    await cli()

    expect(run).toHaveBeenCalledWith('test-project')
    expect(process.exitCode).toBe(130)
  })

  it('首次信号后任务未响应时应该在宽限期结束后强制退出', async () => {
    vi.useFakeTimers()
    const previousListeners = new Set(process.listeners('SIGTERM'))
    let resolveRun: (() => void) | undefined
    let signalHandler: NodeJS.SignalsListener | undefined
    const exit = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)
    run.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveRun = resolve
          signalHandler = process
            .listeners('SIGTERM')
            .find(listener => !previousListeners.has(listener))
          ;(signalHandler as (signal: NodeJS.Signals) => void)('SIGTERM')
        }),
    )

    const cliPromise = cli()
    await vi.waitFor(() => expect(signalHandler).toBeTypeOf('function'))
    expect(process.exitCode).toBe(130)
    await vi.advanceTimersByTimeAsync(5_000)

    expect(exit).toHaveBeenCalledWith(130)
    resolveRun?.()
    await cliPromise
  })

  it('领域错误输出简洁消息并设置退出码', async () => {
    run.mockRejectedValue(
      new AppError('Invalid project options', {
        code: 'CREATE_INVALID_OPTIONS',
      }),
    )

    await cli()

    expect(logger.error).toHaveBeenCalledWith('Invalid project options')
    expect(process.exitCode).toBe(1)
  })

  it('错误日志失败时仍然保留退出码', async () => {
    run.mockRejectedValue(
      new AppError('Invalid project options', {
        code: 'CREATE_INVALID_OPTIONS',
      }),
    )
    vi.mocked(logger.error).mockImplementationOnce(() => {
      throw new Error('Logger failed')
    })

    await expect(cli()).resolves.toBeUndefined()
    expect(process.exitCode).toBe(1)
  })

  it('未知错误保留诊断信息并设置退出码', async () => {
    const error = new Error('Unexpected failure')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    run.mockRejectedValue(error)

    await cli()

    expect(consoleError).toHaveBeenCalledWith(error)
    expect(process.exitCode).toBe(1)
  })
})
