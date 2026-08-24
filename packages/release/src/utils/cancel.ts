import { logger } from '@eljs/utils/logger'

import { AppError } from './error'

/**
 * 输出取消提示并中断当前发布调用链
 *
 * @remarks
 * 该函数用于 prompts 的 `onCancel` 回调，异常会由 ReleaseRunner 的清理边界接收
 *
 * @throws {@link AppError} 始终抛出取消错误
 */
export function onCancel(): never {
  try {
    logger.event('Cancel release')
  } catch {
    // 日志失败不应覆盖用户取消这一核心语义
  }
  throw new AppError('Release cancelled')
}
