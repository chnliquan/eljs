/**
 * 睡眠 ms 毫秒
 * @param ms 毫秒
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * 超时拒绝
 * @param promise promise
 * @param ms 超时时间
 * @param message 超时信息
 */
export function timeout<T>(
  promise: Promise<T>,
  ms: number,
  message?: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let finished = false

    promise
      .then(data => {
        finished = true
        resolve(data)
      })
      .catch((err: unknown) => {
        finished = true
        reject(err)
      })

    setTimeout(() => maybeTimeout(), ms)

    function maybeTimeout() {
      if (finished) {
        return
      }

      reject(new Error(message || 'Timeout'))
    }
  })
}
