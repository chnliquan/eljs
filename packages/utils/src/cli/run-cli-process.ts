import { logger } from '../logger'

/** 首次终止信号后等待异步清理完成的最长时间（毫秒） */
export const CLI_FORCE_EXIT_GRACE_PERIOD_MS = 5_000

/**
 * CLI 进程外壳的域注入参数
 */
export interface RunCliProcessOptions {
  /**
   * 命令名，用于取消日志与错误消息
   */
  name: string
  /**
   * CLI 主流程，接收进程取消信号
   */
  run(signal: AbortSignal): Promise<void>
  /**
   * 构造进程信号取消时注入 controller 的错误
   *
   * @remarks
   * 返回值会作为 `AbortController.abort` 的 reason 抛给上层错误分类
   */
  createCancelReason(signal: NodeJS.Signals): unknown
  /**
   * 判定主流程抛出的错误是否为用户取消
   *
   * @remarks
   * 命中时进程按 130 退出，语义对齐 Unix 终止信号
   */
  isCancellation(error: unknown): boolean
  /**
   * 判定错误是否为可直接展示给用户的域错误
   *
   * @remarks
   * 缺省按 `error instanceof Error && error.name === 'AppError'` 识别
   */
  isAppError?(error: unknown): boolean
}

/**
 * 运行 CLI 进程外壳
 *
 * @remarks
 * 内聚 SIGINT/SIGTERM 注册、首次信号宽限期强退、二次信号立即退出、
 * 错误分类（取消 130 / 域错误 1 / 未知 1）与监听器清理。
 * 域知识通过 options 注入，本函数不感知任何包的错误码
 *
 * @param options - 域注入参数
 * @returns 进程外壳流程 Promise，resolve 时退出码已写入 `process.exitCode`
 */
export function runCliProcess(options: RunCliProcessOptions): Promise<void> {
  const controller = new AbortController()
  const disposeSignalHandlers = registerSignalHandlers(
    controller,
    options.name,
    options.createCancelReason,
  )

  return options
    .run(controller.signal)
    .then(() => {
      if (controller.signal.aborted) {
        throw controller.signal.reason
      }
    })
    .catch(error => {
      if (options.isCancellation(error) || controller.signal.aborted) {
        process.exitCode = 130
      } else if (isAppError(options, error)) {
        process.exitCode = 1
        try {
          logger.error((error as Error).message)
        } catch {
          // 日志是辅助能力，域错误仍需保持稳定退出语义
        }
      } else {
        process.exitCode = 1
        try {
          console.error(error)
        } catch {
          // 控制台异常不能让 CLI 错误处理再次失败
        }
      }
    })
    .finally(disposeSignalHandlers)
}

/**
 * 判定错误是否为可直接展示给用户的域错误
 *
 * @remarks
 * 各 CLI 包的 AppError 构造函数均设置 `name` 为 `AppError`，
 * 结构化识别可避免 utils 反向依赖任何 CLI 包
 *
 * @param options - 域注入参数
 * @param error - 主流程抛出的错误
 * @returns 域错误返回 `true`
 */
function isAppError(options: RunCliProcessOptions, error: unknown): boolean {
  if (options.isAppError) {
    return options.isAppError(error)
  }

  return error instanceof Error && error.name === 'AppError'
}

/**
 * 注册 CLI 进程信号并返回对称的清理函数
 *
 * @param controller - 当前流程的取消控制器
 * @param name - 取消日志中的命令名
 * @param createCancelReason - 构造取消原因的域回调
 * @returns 移除本次注册信号监听器的函数
 */
function registerSignalHandlers(
  controller: AbortController,
  name: string,
  createCancelReason: (signal: NodeJS.Signals) => unknown,
): () => void {
  let forceExitTimer: NodeJS.Timeout | undefined

  const handleSignal = (signal: NodeJS.Signals) => {
    if (!controller.signal.aborted) {
      try {
        logger.event(`Cancelling ${name} after ${signal}`)
      } catch {
        // 日志是辅助能力，不能阻止信号触发实际取消
      }
      // 即使后续只剩不持有事件循环句柄的悬空 Promise，自然退出也必须保留取消语义
      process.exitCode = 130
      controller.abort(createCancelReason(signal))
      // 第三方依赖可能忽略 AbortSignal，宽限期后退出可避免进程无限挂起
      forceExitTimer = setTimeout(
        () => process.exit(130),
        CLI_FORCE_EXIT_GRACE_PERIOD_MS,
      )
      forceExitTimer.unref()
      return
    }

    process.exit(130)
  }

  process.on('SIGINT', handleSignal)
  process.on('SIGTERM', handleSignal)

  return () => {
    if (forceExitTimer) {
      clearTimeout(forceExitTimer)
    }
    process.off('SIGINT', handleSignal)
    process.off('SIGTERM', handleSignal)
  }
}
