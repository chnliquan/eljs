import { logger } from '@eljs/utils/logger'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { onCancel } from '../src/utils'

vi.mock('@eljs/utils/logger', async importOriginal => {
  const actual = await importOriginal<typeof import('@eljs/utils/logger')>()

  return {
    ...actual,
    logger: {
      ...actual.logger,
      event: vi.fn(),
    },
  }
})

describe('create-template 交互工具', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('取消时记录事件并抛出稳定领域错误', () => {
    expect(() => onCancel()).toThrow(
      expect.objectContaining({
        code: 'CREATE_OPERATION_CANCELLED',
        message: 'Create template operation was cancelled by the user',
      }),
    )
    expect(logger.event).toHaveBeenCalledWith('Cancel create template')
  })
})
