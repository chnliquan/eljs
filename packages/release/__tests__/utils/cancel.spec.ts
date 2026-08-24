import { beforeEach, describe, expect, it, vi } from 'vitest'

import { logger } from '@eljs/utils/logger'

import { onCancel } from '../../src/utils/cancel'
import { AppError } from '../../src/utils/error'

vi.mock('@eljs/utils/logger', () => ({
  logger: {
    event: vi.fn(),
  },
}))

describe('发布取消处理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该记录事件并抛出可由发布清理边界接收的错误', () => {
    const exit = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)

    expect(() => onCancel()).toThrow(
      expect.objectContaining({
        message: 'Release cancelled',
        name: 'AppError',
      }),
    )
    expect(logger.event).toHaveBeenCalledWith('Cancel release')
    expect(exit).not.toHaveBeenCalled()
  })

  it('应该抛出公开的 AppError 类型', () => {
    expect(() => onCancel()).toThrow(AppError)
  })

  it('日志记录失败时仍应该保留取消语义', () => {
    vi.mocked(logger.event).mockImplementation(() => {
      throw new Error('日志记录失败')
    })

    expect(() => onCancel()).toThrow(AppError)
  })
})
