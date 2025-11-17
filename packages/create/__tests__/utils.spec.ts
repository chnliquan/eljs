import * as eljsUtils from '@eljs/utils'
import { AppError, onCancel } from '../src/utils'

// Mock @eljs/utils
jest.mock('@eljs/utils', () => ({
  logger: {
    event: jest.fn(),
  },
}))

const mockedEljs = eljsUtils as jest.Mocked<typeof eljsUtils>

// Mock process.exit
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called')
})

describe('工具函数模块', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    mockProcessExit.mockClear()
  })

  afterAll(() => {
    mockProcessExit.mockRestore()
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
      expect(() => onCancel()).toThrow('process.exit called')

      expect(mockedEljs.logger.event).toHaveBeenCalledTimes(1)
      expect(mockedEljs.logger.event).toHaveBeenCalledWith('Cancel create')
    })

    it('应该调用 process.exit 并传入退出码 0', () => {
      expect(() => onCancel()).toThrow('process.exit called')

      expect(mockProcessExit).toHaveBeenCalledTimes(1)
      expect(mockProcessExit).toHaveBeenCalledWith(0)
    })

    it('应该在退出进程前记录日志', () => {
      // 验证 logger.event 和 process.exit 都被调用
      expect(() => onCancel()).toThrow('process.exit called')

      expect(mockedEljs.logger.event).toHaveBeenCalledWith('Cancel create')
      expect(mockProcessExit).toHaveBeenCalledWith(0)
    })
  })
})
