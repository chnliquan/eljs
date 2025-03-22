import { logger } from '@eljs/utils'

/**
 * 用户取消
 */
export function onCancel() {
  logger.event('Cancel release')
  process.exit(0)
}
