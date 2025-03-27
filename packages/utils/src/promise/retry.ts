import type { MaybePromiseFunction } from '@/types'

import { sleep } from './timer'

/**
 * 重试任务
 * @param fn 执行函数
 * @param retries 重试次数
 * @param delay 延时
 */
export async function retry<T>(
  fn: MaybePromiseFunction<T>,
  retries = 3,
  delay = 100,
): Promise<T> {
  let lastError: Error | undefined

  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      await sleep(delay)
    }
  }

  throw lastError
}

/**
 * 重试直到函数返回非 undefined/null 值
 * @param fn 执行函数
 * @param retries 重试次数
 * @param delay 延时
 */
export async function retryWithValue<T>(
  fn: MaybePromiseFunction<T>,
  retries = 3,
  delay = 100,
): Promise<T | undefined> {
  let attempts = 0
  let result: T | undefined | null

  while (attempts < retries) {
    result = await fn()

    if (result !== undefined && result !== null) {
      return result
    }

    await sleep(delay)
    attempts++
  }

  return undefined
}
