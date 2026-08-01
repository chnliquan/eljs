import { logger } from '@eljs/utils'

/**
 * 输出取消提示并结束当前进程
 *
 * @remarks
 * 该函数会以退出码 `0` 立即终止进程
 */
export function onCancel() {
  logger.event('Cancel release')
  process.exit(0)
}
