import { logger } from '@eljs/utils'

/**
 * 应用错误
 */
export class AppError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * 用户取消
 */
export function onCancel() {
  logger.event('Cancel create')
  process.exit(0)
}
