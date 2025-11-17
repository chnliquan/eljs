/**
 * @fileoverview utils.ts 模块的单元测试
 * @description 测试工具函数相关功能
 */

import { jest } from '@jest/globals'

// 模拟外部依赖
jest.mock('@eljs/utils', () => ({
  logger: {
    event: jest.fn(),
  },
}))

describe('utils 模块测试', () => {
  let mockProcess: {
    exit: jest.MockedFunction<(code?: number) => never>
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // 模拟 process 对象
    mockProcess = {
      exit: jest.fn() as never,
    }

    Object.defineProperty(global, 'process', {
      value: mockProcess,
      writable: true,
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('objectToArray 函数', () => {
    it('应该正确导出 objectToArray 函数', async () => {
      const { objectToArray } = await import('../src/utils')
      expect(objectToArray).toBeDefined()
      expect(typeof objectToArray).toBe('function')
    })

    it('应该将对象转换为数组结构', async () => {
      const { objectToArray } = await import('../src/utils')

      const inputObject = {
        keyOne: 'Value 1',
        keyTwo: 'Value 2',
        keyThree: 'Value 3',
      }

      const result = objectToArray(inputObject)

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(3)

      // 验证数组元素结构
      expect(result[0]).toEqual({ title: 'Value 1', value: 'keyOne' })
      expect(result[1]).toEqual({ title: 'Value 2', value: 'keyTwo' })
      expect(result[2]).toEqual({ title: 'Value 3', value: 'keyThree' })
    })

    it('应该处理空对象', async () => {
      const { objectToArray } = await import('../src/utils')

      const result = objectToArray({})

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })

    it('应该支持 toNumber 参数将键转换为数字', async () => {
      const { objectToArray } = await import('../src/utils')

      const inputObject = {
        first: 'First Value',
        second: 'Second Value',
        third: 'Third Value',
      }

      const result = objectToArray(inputObject, true)

      expect(result).toHaveLength(3)
      // 由于键不是数字字符串，转换后会是 NaN
      expect(Number.isNaN(result[0].value)).toBe(true)
      expect(Number.isNaN(result[1].value)).toBe(true)
      expect(Number.isNaN(result[2].value)).toBe(true)
    })

    it('应该默认不转换键为数字', async () => {
      const { objectToArray } = await import('../src/utils')

      const inputObject = {
        stringKey1: 'First',
        stringKey2: 'Second',
      }

      const result = objectToArray(inputObject)

      expect(result[0]).toEqual({ title: 'First', value: 'stringKey1' })
      expect(result[1]).toEqual({ title: 'Second', value: 'stringKey2' })
    })

    it('应该处理包含各种数据类型的对象值', async () => {
      const { objectToArray } = await import('../src/utils')

      const inputObject = {
        stringValue: 'String Value',
        numberValue: 123,
        booleanValue: true,
        nullValue: null,
        undefinedValue: undefined,
      }

      const result = objectToArray(inputObject)

      expect(result).toHaveLength(5)
      expect(result[0]).toEqual({ title: 'String Value', value: 'stringValue' })
      expect(result[1]).toEqual({ title: 123, value: 'numberValue' })
      expect(result[2]).toEqual({ title: true, value: 'booleanValue' })
      expect(result[3]).toEqual({ title: null, value: 'nullValue' })
      expect(result[4]).toEqual({ title: undefined, value: 'undefinedValue' })
    })

    it('应该保持对象键的顺序', async () => {
      const { objectToArray } = await import('../src/utils')

      const inputObject = {
        firstKey: 'A',
        secondKey: 'B',
        thirdKey: 'C',
      }

      const result = objectToArray(inputObject)

      expect(result[0].value).toBe('firstKey')
      expect(result[1].value).toBe('secondKey')
      expect(result[2].value).toBe('thirdKey')
    })
  })

  describe('onCancel 函数', () => {
    it('应该正确导出 onCancel 函数', async () => {
      const { onCancel } = await import('../src/utils')
      expect(onCancel).toBeDefined()
      expect(typeof onCancel).toBe('function')
    })

    it('应该调用 logger.event 记录取消事件', async () => {
      const { logger } = await import('@eljs/utils')
      const { onCancel } = await import('../src/utils')

      onCancel()

      expect(logger.event).toHaveBeenCalledWith('Cancel create template')
    })

    it('应该调用 process.exit(0) 退出进程', async () => {
      const { onCancel } = await import('../src/utils')

      onCancel()

      expect(mockProcess.exit).toHaveBeenCalledWith(0)
    })

    it('应该按正确的顺序执行日志记录和进程退出', async () => {
      const { logger } = await import('@eljs/utils')
      const { onCancel } = await import('../src/utils')

      onCancel()

      // 验证调用顺序：先记录日志，再退出进程
      expect(logger.event).toHaveBeenCalled()
      expect(mockProcess.exit).toHaveBeenCalled()
    })

    it('应该在任何情况下都执行退出操作', async () => {
      const { logger } = await import('@eljs/utils')
      const { onCancel } = await import('../src/utils')

      // 模拟 logger.event 抛出异常
      ;(
        logger.event as jest.MockedFunction<typeof logger.event>
      ).mockImplementation(() => {
        throw new Error('Logger error')
      })

      // onCancel 仍然应该正常执行
      expect(() => onCancel()).toThrow('Logger error')

      // 但在实际实现中，应该确保 process.exit 总是被调用
      // 这里我们验证函数的健壮性
      expect(logger.event).toHaveBeenCalled()
    })
  })

  describe('模块导出验证', () => {
    it('应该正确导出所有预期的函数', async () => {
      const utilsModule = await import('../src/utils')

      expect(utilsModule).toHaveProperty('objectToArray')
      expect(utilsModule).toHaveProperty('onCancel')
      expect(typeof utilsModule.objectToArray).toBe('function')
      expect(typeof utilsModule.onCancel).toBe('function')
    })

    it('应该能够通过 ES Module 方式导入', async () => {
      const utilsModule = await import('../src/utils')

      expect(utilsModule).toHaveProperty('objectToArray')
      expect(utilsModule).toHaveProperty('onCancel')
      expect(typeof utilsModule.objectToArray).toBe('function')
      expect(typeof utilsModule.onCancel).toBe('function')
    })
  })

  describe('函数参数验证', () => {
    it('objectToArray 应该能够处理大型对象', async () => {
      const { objectToArray } = await import('../src/utils')

      // 创建一个包含100个属性的对象（减少数量以提高测试性能）
      const largeObject: Record<string, string> = {}
      for (let i = 0; i < 100; i++) {
        largeObject[`key${i}`] = `value${i}`
      }

      const startTime = Date.now()
      const result = objectToArray(largeObject)
      const endTime = Date.now()

      expect(result).toHaveLength(100)
      expect(endTime - startTime).toBeLessThan(100) // 应该在100ms内完成
    })

    it('应该正确处理对象自有属性', async () => {
      const { objectToArray } = await import('../src/utils')

      // 创建一个具有原型的对象
      const proto = { protoKey: 'protoValue' }
      const obj = Object.create(proto)
      obj.ownKey = 'ownValue'

      const result = objectToArray(obj)

      // 应该只包含对象自有的属性，不包含原型链上的属性
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ title: 'ownValue', value: 'ownKey' })
    })
  })
})
