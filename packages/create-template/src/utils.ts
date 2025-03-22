import { chalk } from '@eljs/utils'

/**
 *  将对象转换成数组
 * @param obj 对象
 * @param toNumber 是否转换为数字
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
 * 用户取消
 */
export function onCancel() {
  console.log(`${chalk.magenta('event')} - Cancel template creation`)
  process.exit(0)
}
