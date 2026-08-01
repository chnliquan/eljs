import { AppError } from '@eljs/create'
import { logger } from '@eljs/utils/logger'

/**
 *  将对象转换成数组
 * @param obj - 对象
 * @param toNumber - 是否转换为数字
 */
export function objectToArray(obj: Record<string, unknown>, toNumber = false) {
  return Object.keys(obj).map(key => {
    const title = obj[key] as string
    return {
      title,
      value: toNumber ? Number(key) : key,
    }
  })
}

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
