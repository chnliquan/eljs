import { logger } from '@eljs/utils/logger'

import { AppError } from './errors'

export { AppError } from './errors'
export type { AppErrorOptions, CreateErrorCode } from './errors'

/**
 * 将交互取消转换为可由上层统一处理的领域错误
 *
 * @throws {@link AppError} 始终抛出用户取消错误
 */
export function onCancel(): never {
  try {
    logger.event('Cancel create')
  } catch {
    // 交互取消必须保留稳定错误语义，不能被日志实现覆盖
  }
  throw new AppError('Create operation was cancelled by the user', {
    code: 'CREATE_OPERATION_CANCELLED',
  })
}
