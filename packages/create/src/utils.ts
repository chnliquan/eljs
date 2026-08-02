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
  logger.event('Cancel create')
  throw new AppError('Create operation was cancelled by the user', {
    code: 'CREATE_OPERATION_CANCELLED',
  })
}
