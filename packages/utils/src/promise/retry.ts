import type { MaybePromiseFunction } from '../types'
import { sleep } from './timer'

function validateRetryOptions(retries: number, delay: number): void {
  if (!Number.isSafeInteger(retries) || retries < 1) {
    throw new RangeError('retries must be a positive safe integer')
  }
  if (!Number.isFinite(delay) || delay < 0 || delay > 2_147_483_647) {
    throw new RangeError('delay must be between 0 and 2147483647 milliseconds')
  }
}

/**
 * 重试任务
 * @param fn - 执行函数
 * @param retries - 最大尝试次数（含首次执行），必须为正安全整数，默认 3 次
 * @param delay - 两次尝试间的毫秒延时，范围为 0 至 2147483647，最后一次失败后不再等待
 * @throws 参数无效时抛出 RangeError；尝试耗尽时原样抛出最后一次异常
 */
export async function retry<T>(
  fn: MaybePromiseFunction<T>,
  retries = 3,
  delay = 100,
): Promise<T> {
  validateRetryOptions(retries, delay)
  let lastError: unknown

  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (i + 1 < retries) {
        await sleep(delay)
      }
    }
  }

  throw lastError
}

/**
 * 重试直到函数返回非 undefined/null 值
 * @param fn - 执行函数
 * @param retries - 最大尝试次数（含首次执行），必须为正安全整数，默认 3 次
 * @param delay - 两次尝试间的毫秒延时，范围为 0 至 2147483647，最后一次返回空值后不再等待
 * @returns 首个非空值，尝试耗尽时返回 undefined
 * @throws 参数无效时抛出 RangeError；执行函数抛错时立即原样传播，不重试异常
 */
export async function retryWithValue<T>(
  fn: MaybePromiseFunction<T>,
  retries = 3,
  delay = 100,
): Promise<T | undefined> {
  validateRetryOptions(retries, delay)
  let attempts = 0
  let result: T | undefined | null

  while (attempts < retries) {
    result = await fn()

    if (result !== undefined && result !== null) {
      return result
    }

    attempts++
    if (attempts < retries) {
      await sleep(delay)
    }
  }

  return undefined
}
