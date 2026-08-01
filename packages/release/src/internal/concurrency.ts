/**
 * 在固定并发上限内映射异步任务并保持输入顺序
 *
 * @param values - 待处理值
 * @param concurrency - 同时运行的最大任务数
 * @param mapper - 单个值的异步映射函数
 * @returns 与输入顺序一致的映射结果
 * @throws 当并发上限不是正整数时抛出 `TypeError`
 * @throws 当任一映射任务失败时传播原始错误并停止领取新任务
 * @internal
 */
export async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError('Concurrency must be a positive integer.')
  }

  if (values.length === 0) {
    return []
  }

  const results = new Array<R>(values.length)
  let nextIndex = 0
  let failed = false

  async function worker(): Promise<void> {
    while (!failed) {
      const index = nextIndex++

      if (index >= values.length) {
        return
      }

      try {
        results[index] = await mapper(values[index], index)
      } catch (error) {
        failed = true
        throw error
      }
    }
  }

  const workerCount = Math.min(concurrency, values.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}
