import { logger } from '@eljs/utils'

/**
 * 用户取消
 */
export function onCancel() {
  logger.event('Cancel create')
  process.exit(0)
}
