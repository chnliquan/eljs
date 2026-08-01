import { describe, expect, it } from 'vitest'

import { mapWithConcurrency } from '../../src/internal/concurrency'

describe('并发任务映射', () => {
  it('应该限制同时运行的任务数并保持输入顺序', async () => {
    let active = 0
    let maximumActive = 0

    const result = await mapWithConcurrency([3, 1, 2, 0], 2, async value => {
      active++
      maximumActive = Math.max(maximumActive, active)
      await new Promise(resolve => setTimeout(resolve, value))
      active--
      return value * 2
    })

    expect(result).toEqual([6, 2, 4, 0])
    expect(maximumActive).toBe(2)
  })

  it.each([0, -1, 1.5, Number.NaN])(
    '应该拒绝无效并发值 %s',
    async concurrency => {
      await expect(
        mapWithConcurrency([1], concurrency, async value => value),
      ).rejects.toThrow('positive integer')
    },
  )

  it('任务失败后不应该继续领取新任务', async () => {
    const visited: number[] = []

    await expect(
      mapWithConcurrency([0, 1, 2, 3], 1, async value => {
        visited.push(value)

        if (value === 1) {
          throw new Error('request failed')
        }

        return value
      }),
    ).rejects.toThrow('request failed')
    expect(visited).toEqual([0, 1])
  })
})
