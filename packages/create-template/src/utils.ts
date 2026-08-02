import { AppError } from '@eljs/create/errors'
import { logger } from '@eljs/utils/logger'

/**
 * 将模版交互取消转换为可由 CLI 或 API 调用方处理的领域错误
 *
 * @throws {@link AppError} 始终抛出用户取消错误
 */
export function onCancel(): never {
  logger.event('Cancel create template')
  throw new AppError('Create template operation was cancelled by the user', {
    code: 'CREATE_OPERATION_CANCELLED',
  })
}
