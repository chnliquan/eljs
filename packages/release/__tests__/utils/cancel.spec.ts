/**
 * @file packages/release utils/cancel 模块单元测试
 * @description 测试 cancel.ts 取消功能
 */

import { logger } from '@eljs/utils'
import { onCancel } from '../../src/utils/cancel'

// 模拟 @eljs/utils 的 logger
jest.mock('@eljs/utils', () => ({
  logger: {
    event: jest.fn(),
  },
}))

describe('用户取消功能测试', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('onCancel 函数基本功能', () => {
    it('应该记录取消发布事件', () => {
      const mockLoggerEvent = logger.event as jest.MockedFunction<
        typeof logger.event
      >

      // 现在 process.exit 已经在 jest.setup.js 中被全局模拟了
      onCancel()

      expect(mockLoggerEvent).toHaveBeenCalledWith('Cancel release')
      expect(mockLoggerEvent).toHaveBeenCalledTimes(1)
    })

    it('应该调用 process.exit(0)', () => {
      onCancel()

      // process.exit 已经被全局模拟，我们检查它被调用
      expect(process.exit).toHaveBeenCalledWith(0)
    })
  })

  describe('onCancel 函数类型安全', () => {
    it('应该是一个无参数无返回值的函数', () => {
      expect(typeof onCancel).toBe('function')
      expect(onCancel.length).toBe(0) // 参数个数为 0
    })

    it('调用时不应该需要任何参数', () => {
      expect(() => onCancel()).not.toThrow()
    })
  })

  describe('onCancel 函数行为验证', () => {
    it('应该使用正确的退出码', () => {
      onCancel()

      expect(process.exit).toHaveBeenCalledWith(0)
      expect(process.exit).not.toHaveBeenCalledWith(1)
    })

    it('应该记录正确的事件消息', () => {
      const mockLoggerEvent = logger.event as jest.MockedFunction<
        typeof logger.event
      >

      onCancel()

      expect(mockLoggerEvent).toHaveBeenCalledWith('Cancel release')
      expect(mockLoggerEvent).not.toHaveBeenCalledWith('Cancel')
      expect(mockLoggerEvent).not.toHaveBeenCalledWith('release canceled')
    })
  })

  describe('onCancel 函数集成行为', () => {
    it('应该能够在信号处理器中正确工作', () => {
      const signalHandler = () => {
        onCancel()
      }

      signalHandler()

      expect(logger.event).toHaveBeenCalledWith('Cancel release')
      expect(process.exit).toHaveBeenCalledWith(0)
    })

    it('应该能够多次调用而不出现副作用', () => {
      const mockLoggerEvent = logger.event as jest.MockedFunction<
        typeof logger.event
      >

      // 第一次调用
      onCancel()
      expect(mockLoggerEvent).toHaveBeenCalledTimes(1)
      expect(process.exit).toHaveBeenCalledTimes(1)

      // 清除模拟调用记录
      jest.clearAllMocks()

      // 第二次调用
      onCancel()
      expect(mockLoggerEvent).toHaveBeenCalledTimes(1)
      expect(process.exit).toHaveBeenCalledTimes(1)
    })
  })

  describe('onCancel 函数错误处理', () => {
    it('当 logger.event 抛出错误时函数应该抛出错误', () => {
      const mockLoggerEvent = logger.event as jest.MockedFunction<
        typeof logger.event
      >
      mockLoggerEvent.mockImplementation(() => {
        throw new Error('日志记录失败')
      })

      expect(() => onCancel()).toThrow('日志记录失败')
      expect(mockLoggerEvent).toHaveBeenCalledWith('Cancel release')
    })
  })

  describe('onCancel 函数模块导出', () => {
    it('应该正确导出 onCancel 函数', () => {
      expect(onCancel).toBeDefined()
      expect(typeof onCancel).toBe('function')
    })
  })
})
