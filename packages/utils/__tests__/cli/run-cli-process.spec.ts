import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CLI_FORCE_EXIT_GRACE_PERIOD_MS,
  runCliProcess,
} from '../../src/cli/run-cli-process'
import { logger } from '../../src/logger'

class TestAppError extends Error {
  public constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

describe('runCliProcess', () => {
  const createCancelReason = (signal: NodeJS.Signals) =>
    new TestAppError(`Operation received ${signal}`, 'OPERATION_CANCELLED')
  const isCancellation = (error: unknown) =>
    error instanceof TestAppError &&
    (error.code === 'OPERATION_ABORTED' || error.code === 'OPERATION_CANCELLED')

  const runHarness = (options?: { run?: () => Promise<void> }) =>
    runCliProcess({
      name: 'create',
      createCancelReason,
      isCancellation,
      run: options?.run ?? vi.fn().mockResolvedValue(undefined),
    })

  beforeEach(() => {
    process.exitCode = undefined
  })

  afterEach(() => {
    process.exitCode = undefined
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('运行主流程并保持退出码未定义', async () => {
    const run = vi.fn().mockResolvedValue(undefined)

    await runHarness({ run })

    expect(run).toHaveBeenCalledWith(expect.any(AbortSignal))
    expect(process.exitCode).toBeUndefined()
  })

  it('域错误记录 logger.error 且退出码为 1', async () => {
    const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const run = vi.fn().mockRejectedValue(new TestAppError('Domain failure'))

    await runHarness({ run })

    expect(loggerError).toHaveBeenCalledWith('Domain failure')
    expect(process.exitCode).toBe(1)
  })

  it('取消错误分类为 130 退出', async () => {
    const run = vi
      .fn()
      .mockRejectedValue(
        new TestAppError('Cancelled by user', 'OPERATION_CANCELLED'),
      )

    await runHarness({ run })

    expect(process.exitCode).toBe(130)
  })

  it('未知错误输出 console.error 且退出码为 1', async () => {
    const error = new Error('Unexpected')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const run = vi.fn().mockRejectedValue(error)

    await runHarness({ run })

    expect(consoleError).toHaveBeenCalledWith(error)
    expect(process.exitCode).toBe(1)
  })

  it('首次信号取消流程并在结束后移除监听器', async () => {
    const loggerEvent = vi.spyOn(logger, 'event').mockImplementation(() => {})
    const previousListeners = new Set(process.listeners('SIGINT'))
    let signalHandler: NodeJS.SignalsListener | undefined
    const run = vi.fn().mockImplementation(async () => {
      signalHandler = process
        .listeners('SIGINT')
        .find(listener => !previousListeners.has(listener))
      ;(signalHandler as (signal: NodeJS.Signals) => void)('SIGINT')
    })

    await runHarness({ run })

    expect(signalHandler).toBeTypeOf('function')
    expect(loggerEvent).toHaveBeenCalledWith('Cancelling create after SIGINT')
    expect(process.exitCode).toBe(130)
    expect(process.listeners('SIGINT')).not.toContain(signalHandler)
  })

  it('信号日志失败时仍然取消流程', async () => {
    const previousListeners = new Set(process.listeners('SIGINT'))
    vi.spyOn(logger, 'event').mockImplementationOnce(() => {
      throw new Error('Logger failed')
    })
    const run = vi.fn().mockImplementation(async () => {
      const signalHandler = process
        .listeners('SIGINT')
        .find(listener => !previousListeners.has(listener))
      ;(signalHandler as (signal: NodeJS.Signals) => void)('SIGINT')
    })

    await runHarness({ run })

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
    const run = vi.fn().mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveRun = resolve
          signalHandler = process
            .listeners('SIGTERM')
            .find(listener => !previousListeners.has(listener))
          ;(signalHandler as (signal: NodeJS.Signals) => void)('SIGTERM')
        }),
    )

    const promise = runHarness({ run })
    await vi.waitFor(() => expect(signalHandler).toBeTypeOf('function'))
    expect(process.exitCode).toBe(130)
    await vi.advanceTimersByTimeAsync(CLI_FORCE_EXIT_GRACE_PERIOD_MS)

    expect(exit).toHaveBeenCalledWith(130)
    resolveRun?.()
    await promise
  })

  it('二次信号立即强制退出', async () => {
    vi.useFakeTimers()
    const previousListeners = new Set(process.listeners('SIGINT'))
    let resolveRun: (() => void) | undefined
    const exit = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)
    const run = vi.fn().mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveRun = resolve
          const signalHandler = process
            .listeners('SIGINT')
            .find(listener => !previousListeners.has(listener))
          ;(signalHandler as (signal: NodeJS.Signals) => void)('SIGINT')
          ;(signalHandler as (signal: NodeJS.Signals) => void)('SIGINT')
        }),
    )

    const promise = runHarness({ run })

    expect(exit).toHaveBeenCalledWith(130)
    resolveRun?.()
    await promise
  })

  it('主流程成功但信号已中止时按取消语义退出', async () => {
    const previousListeners = new Set(process.listeners('SIGINT'))
    const run = vi.fn().mockImplementation(async () => {
      const signalHandler = process
        .listeners('SIGINT')
        .find(listener => !previousListeners.has(listener))
      ;(signalHandler as (signal: NodeJS.Signals) => void)('SIGINT')
    })

    await runHarness({ run })

    expect(process.exitCode).toBe(130)
  })

  it('自定义 isAppError 判定优先于默认谓词', async () => {
    const run = vi.fn().mockRejectedValue(new TestAppError('Domain failure'))

    await runCliProcess({
      name: 'x',
      createCancelReason,
      isCancellation,
      isAppError: () => false,
      run,
    })

    expect(process.exitCode).toBe(1)
  })
})
