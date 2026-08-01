import type { UtilsLogEntry, UtilsOperationEvent, UtilsRuntime } from './types'

/**
 * 调用日志适配器并隔离适配器自身异常
 *
 * @internal
 */
export function emitUtilsLog(
  runtime: UtilsRuntime | undefined,
  entry: UtilsLogEntry,
): void {
  try {
    runtime?.logger?.(entry)
  } catch {
    // 观测适配器不能改变业务操作的成功或失败状态
  }
}

/**
 * 调用监控适配器并隔离适配器自身异常
 *
 * @internal
 */
export function emitUtilsEvent(
  runtime: UtilsRuntime | undefined,
  event: UtilsOperationEvent,
): void {
  try {
    runtime?.observer?.(event)
  } catch {
    // 观测适配器不能改变业务操作的成功或失败状态
  }
}
