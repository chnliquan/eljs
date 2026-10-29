/**
 * 睡眠 ms 毫秒
 * @param ms - 毫秒
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * 超时拒绝
 * @remarks 原任务完成后清理计时器；超时仅拒绝返回值，不取消原任务
 * @param promise - promise
 * @param ms - 超时时间
 * @param message - 超时信息
 */
export function timeout<T>(
  promise: Promise<T>,
  ms: number,
  message?: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message ?? 'Timeout')), ms)
    promise.then(
      data => {
        clearTimeout(timer)
        resolve(data)
      },
      error => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}
