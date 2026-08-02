import { AppError } from '@eljs/create/errors'
import { logger } from '@eljs/utils/logger'

/**
 * 将模版交互取消转换为可由 CLI 或 API 调用方处理的领域错误
 *
 * @throws {@link AppError} 始终抛出用户取消错误
 */
export function onCancel(): never {
  try {
    logger.event('Cancel create template')
  } catch {
    // 交互取消必须保留稳定错误语义，不能被日志实现覆盖
  }
  throw new AppError('Create template operation was cancelled by the user', {
    code: 'CREATE_OPERATION_CANCELLED',
  })
}
