import { chalk } from '@eljs/utils'

/**
 * 用户取消
 */
export function onCancel() {
  console.log(`${chalk.magenta('event')} - Cancel release`)
  process.exit(0)
}
