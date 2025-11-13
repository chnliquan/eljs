import {
  Deferred,
  retry,
  retryWithValue,
  sleep,
  timeout,
} from '../../src/promise'

describe('Promise 工具函数', () => {
  describe('sleep 睡眠函数', () => {
    it('应该在指定毫秒数后解决', async () => {
      const start = Date.now()
      await sleep(100)
      const duration = Date.now() - start

      // 允许一些时间偏差 (±50ms)
      expect(duration).toBeGreaterThanOrEqual(100)
      expect(duration).toBeLessThan(200)
    })

    it('应该处理零延迟', async () => {
      const start = Date.now()
      await sleep(0)
      const duration = Date.now() - start

      expect(duration).toBeLessThan(50)
    })

    it('应该返回 void', async () => {
      const result = await sleep(10)
      expect(result).toBeUndefined()
    })
  })

  describe('timeout 超时函数', () => {
    it('应该在超时时间内返回 Promise 值', async () => {
      const promise = Promise.resolve('success')
      const result = await timeout(promise, 100)

      expect(result).toBe('success')
    })

    it('应该在 Promise 耗时过长时抛出超时错误', async () => {
      const promise = new Promise(resolve =>
        setTimeout(() => resolve('success'), 200),
      )

      await expect(timeout(promise, 100)).rejects.toThrow('Timeout')
    })

    it('应该抛出自定义超时消息', async () => {
      const promise = new Promise(resolve =>
        setTimeout(() => resolve('success'), 200),
      )

      await expect(timeout(promise, 100, '自定义超时消息')).rejects.toThrow(
        '自定义超时消息',
      )
    })

    it('应该在超时前抛出原始错误', async () => {
      const error = new Error('原始错误')
      const promise = Promise.reject(error)

      await expect(timeout(promise, 100)).rejects.toThrow('原始错误')
    })

    it('不应该干扰快速解决的 Promise', async () => {
      const promise = Promise.resolve(42)
      const result = await timeout(promise, 1000)

      expect(result).toBe(42)
    })

    it('应该处理恰好在超时边界解决的 Promise', async () => {
      const promise = new Promise(resolve =>
        setTimeout(() => resolve('success'), 100),
      )

      const result = await timeout(promise, 110)
      expect(result).toBe('success')
    })
  })

  describe('Deferred 延期控制器', () => {
    it('应该创建可以被解决的延期 Promise', async () => {
      const deferred = new Deferred<string>()

      setTimeout(() => deferred.resolve('解决值'), 10)

      const result = await deferred.promise
      expect(result).toBe('解决值')
    })

    it('应该创建可以被拒绝的延期 Promise', async () => {
      const deferred = new Deferred<string>()
      const error = new Error('测试错误')

      setTimeout(() => deferred.reject(error), 10)

      await expect(deferred.promise).rejects.toThrow('测试错误')
    })

    it('应该处理类似 Promise 的值解决', async () => {
      const deferred = new Deferred<string>()
      const promiseLike = Promise.resolve('类似 Promise 的值')

      deferred.resolve(promiseLike)

      const result = await deferred.promise
      expect(result).toBe('类似 Promise 的值')
    })

    it('只应该解决一次', async () => {
      const deferred = new Deferred<number>()

      deferred.resolve(1)
      deferred.resolve(2) // 这个应该被忽略

      const result = await deferred.promise
      expect(result).toBe(1)
    })

    it('只应该拒绝一次', async () => {
      const deferred = new Deferred<number>()
      const error1 = new Error('第一个错误')
      const error2 = new Error('第二个错误')

      deferred.reject(error1)
      deferred.reject(error2) // 这个应该被忽略

      await expect(deferred.promise).rejects.toThrow('第一个错误')
    })
  })

  describe('retry 重试函数', () => {
    it('应该在第一次尝试时成功', async () => {
      let callCount = 0
      const fn = jest.fn().mockImplementation(() => {
        callCount++
        return 'success'
      })

      const result = await retry(fn, 3, 10)

      expect(result).toBe('success')
      expect(callCount).toBe(1)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('应该在失败后重试并最终成功', async () => {
      let callCount = 0
      const fn = jest.fn().mockImplementation(() => {
        callCount++
        if (callCount < 3) {
          throw new Error(`第 ${callCount} 次尝试失败`)
        }
        return 'success'
      })

      const result = await retry(fn, 3, 10)

      expect(result).toBe('success')
      expect(callCount).toBe(3)
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('应该在耗尽所有重试后失败', async () => {
      let callCount = 0
      const fn = jest.fn().mockImplementation(() => {
        callCount++
        throw new Error(`第 ${callCount} 次尝试失败`)
      })

      await expect(retry(fn, 3, 10)).rejects.toThrow('第 3 次尝试失败')
      expect(callCount).toBe(3)
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('应该与异步函数一起工作', async () => {
      let callCount = 0
      const fn = jest.fn().mockImplementation(async () => {
        callCount++
        await sleep(5)
        if (callCount < 2) {
          throw new Error(`异步第 ${callCount} 次尝试失败`)
        }
        return '异步成功'
      })

      const result = await retry(fn, 3, 10)

      expect(result).toBe('异步成功')
      expect(callCount).toBe(2)
    })

    it('应该遵守重试之间的延迟', async () => {
      let callCount = 0
      let lastCallTime = Date.now()
      const delays: number[] = []

      const fn = jest.fn().mockImplementation(() => {
        callCount++
        if (callCount > 1) {
          const now = Date.now()
          delays.push(now - lastCallTime)
        }
        lastCallTime = Date.now()

        if (callCount < 3) {
          throw new Error(`第 ${callCount} 次尝试失败`)
        }
        return 'success'
      })

      await retry(fn, 3, 50)

      expect(delays.length).toBe(2)
      expect(delays[0]).toBeGreaterThanOrEqual(45) // 允许时间偏差
      expect(delays[1]).toBeGreaterThanOrEqual(45)
    })

    it('应该使用默认参数', async () => {
      let callCount = 0
      const fn = jest.fn().mockImplementation(() => {
        callCount++
        throw new Error(`第 ${callCount} 次尝试失败`)
      })

      await expect(retry(fn)).rejects.toThrow('第 3 次尝试失败')
      expect(callCount).toBe(3)
    })
  })

  describe('retryWithValue 值重试函数', () => {
    it('应该在第一次尝试时返回值', async () => {
      const fn = jest.fn().mockReturnValue('success')

      const result = await retryWithValue(fn, 3, 10)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('应该重试直到获得非 null/undefined 值', async () => {
      let callCount = 0
      const fn = jest.fn().mockImplementation(() => {
        callCount++
        if (callCount < 3) {
          return null
        }
        return 'success'
      })

      const result = await retryWithValue(fn, 3, 10)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('应该在耗尽重试后返回 undefined', async () => {
      const fn = jest.fn().mockReturnValue(null)

      const result = await retryWithValue(fn, 3, 10)

      expect(result).toBeUndefined()
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('应该区分 null 和 undefined', async () => {
      let callCount = 0
      const fn = jest.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) return undefined
        if (callCount === 2) return null
        return 'success'
      })

      const result = await retryWithValue(fn, 3, 10)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('应该与异步函数一起工作', async () => {
      let callCount = 0
      const fn = jest.fn().mockImplementation(async () => {
        callCount++
        await sleep(5)
        if (callCount < 2) {
          return undefined
        }
        return '异步成功'
      })

      const result = await retryWithValue(fn, 3, 10)

      expect(result).toBe('异步成功')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('应该返回非 null/undefined 的假值', async () => {
      let callCount = 0
      const values = [undefined, null, 0, false, '']
      const fn = jest.fn().mockImplementation(() => {
        return values[callCount++]
      })

      const result = await retryWithValue(fn, 5, 10)

      expect(result).toBe(0)
      expect(fn).toHaveBeenCalledTimes(3) // undefined, null, 然后是 0
    })
  })
})
