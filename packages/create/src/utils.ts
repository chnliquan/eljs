import { chalk } from '@eljs/utils'

/**
 * 用户取消
 */
export function onCancel() {
  console.log(`${chalk.magenta('event')} - Cancel create`)
  process.exit(0)
}
