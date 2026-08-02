import { AppError } from '@eljs/create/errors'
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
import { CreateTemplate } from '../src/create'

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
vi.mock('../src/create')

describe('create-template CLI', () => {
  const originalArgv = process.argv
  const mockedCreateDebugger = createDebugger as MockedFunction<
    typeof createDebugger
  >
  const mockedCreateTemplate = CreateTemplate as MockedClass<
    typeof CreateTemplate
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
    process.argv = ['node', 'create-template', 'test-project']
    debug.mockReset()
    notify.mockReset()
    run.mockReset().mockResolvedValue(undefined)
    mockedCreateDebugger.mockReturnValue(debug)
    mockedReadJson.mockResolvedValue({
      name: '@eljs/create-template',
      version: '1.3.2-alpha.0',
    })
    mockedUpdateNotifier.mockReturnValue({
      notify,
    } as unknown as ReturnType<typeof updateNotifier>)
    mockedCreateTemplate.mockImplementation(function MockCreateTemplate() {
      return { run } as never
    })
  })

  afterEach(() => {
    process.argv = originalArgv
    process.exitCode = undefined
    vi.restoreAllMocks()
  })

  it('使用真实 Commander 解析参数并运行创建器', async () => {
    process.argv = [
      'node',
      'create-template',
      'orders-service',
      '--cwd',
      '/workspace',
      '--scene',
      'npm',
      '--template',
      'template-npm-node',
      '--force',
      '--allow-template-scripts',
    ]

    await cli()

    expect(mockedCreateTemplate).toHaveBeenCalledWith({
      allowTemplateScripts: true,
      cwd: '/workspace',
      force: true,
      scene: 'npm',
      signal: expect.any(AbortSignal),
      template: 'template-npm-node',
    })
    expect(run).toHaveBeenCalledWith('orders-service')
    expect(process.exitCode).toBeUndefined()
  })

  it('为每次调用创建独立命令实例', async () => {
    await cli()
    await cli()

    expect(mockedCreateTemplate).toHaveBeenCalledTimes(2)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('输出调试信息并执行更新提示', async () => {
    process.argv = ['node', 'create-template', 'debug-project', '--merge']

    await cli()

    expect(mockedCreateDebugger).toHaveBeenCalledWith('create-template:cli')
    expect(debug).toHaveBeenCalledWith('projectName:', 'debug-project')
    expect(debug).toHaveBeenCalledWith('options:%O', { merge: true })
    expect(mockedUpdateNotifier).toHaveBeenCalledWith({
      pkg: { name: '@eljs/create-template', version: '1.3.2-alpha.0' },
    })
    await vi.waitFor(() => expect(notify).toHaveBeenCalledOnce())
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

  it('首次信号会取消流程并在结束后移除监听器', async () => {
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
    expect(logger.event).toHaveBeenCalledWith(
      'Cancelling create template after SIGINT',
    )
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

  it('领域错误输出简洁消息并设置退出码', async () => {
    run.mockRejectedValue(
      new AppError('Unknown application scene', {
        code: 'CREATE_INVALID_OPTIONS',
      }),
    )

    await cli()

    expect(logger.error).toHaveBeenCalledWith('Unknown application scene')
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

  it('读取包信息失败时不会启动命令解析', async () => {
    const error = new Error('Failed to read package.json')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockedReadJson.mockRejectedValue(error)

    await cli()

    expect(mockedCreateTemplate).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
  })
})
