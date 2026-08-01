import * as eljsUtils from '@eljs/utils'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mocked,
} from 'vitest'
import { AppError, onCancel } from '../src/utils'

// Mock @eljs/utils
vi.mock('@eljs/utils/logger', async () => import('@eljs/utils'))
vi.mock('@eljs/utils', () => ({
  logger: {
    event: vi.fn(),
  },
}))

const mockedEljs = eljsUtils as Mocked<typeof eljsUtils>

describe('工具函数模块', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('AppError 类', () => {
    it('应该创建 AppError 实例', () => {
      const error = new AppError('测试错误信息')

      expect(error).toBeInstanceOf(AppError)
      expect(error).toBeInstanceOf(Error)
    })

    it('应该设置正确的错误信息', () => {
      const message = '测试错误信息'
      const error = new AppError(message)

      expect(error.message).toBe(message)
    })

    it('应该将错误名称设置为 "AppError"', () => {
      const error = new AppError('测试错误信息')

      expect(error.name).toBe('AppError')
    })

    it('应该处理空字符串错误信息', () => {
      const error = new AppError('')

      expect(error.message).toBe('')
      expect(error.name).toBe('AppError')
    })

    it('应该处理包含特殊字符的错误信息', () => {
      const message = '包含特殊字符的错误: !@#$%^&*()_+{}|:"<>?[];\\,./`~'
      const error = new AppError(message)

      expect(error.message).toBe(message)
    })

    it('应该包含正确的堆栈跟踪信息', () => {
      const error = new AppError('测试错误信息')

      expect(error.stack).toBeDefined()
      expect(typeof error.stack).toBe('string')
    })

    it('应该能够被正确抛出', () => {
      expect(() => {
        throw new AppError('测试错误信息')
      }).toThrow(AppError)

      expect(() => {
        throw new AppError('测试错误信息')
      }).toThrow('测试错误信息')
    })
  })

  describe('onCancel 函数', () => {
    it('应该是一个函数', () => {
      expect(typeof onCancel).toBe('function')
    })

    it('应该调用 logger.event 记录正确的信息', () => {
      expect(() => onCancel()).toThrow(AppError)

      expect(mockedEljs.logger.event).toHaveBeenCalledTimes(1)
      expect(mockedEljs.logger.event).toHaveBeenCalledWith('Cancel create')
    })

    it('应该抛出稳定的用户取消错误', () => {
      expect(() => onCancel()).toThrow(
        expect.objectContaining({
          code: 'CREATE_OPERATION_CANCELLED',
          name: 'AppError',
        }),
      )
    })

    it('应该在抛出取消错误前记录日志', () => {
      expect(() => onCancel()).toThrow(AppError)

      expect(mockedEljs.logger.event).toHaveBeenCalledWith('Cancel create')
    })
  })
})
