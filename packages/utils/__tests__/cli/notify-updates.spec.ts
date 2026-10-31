import { beforeEach, describe, expect, it, vi } from 'vitest'

import { notifyUpdates } from '../../src/cli/notify-updates'

const updateNotifierMock = vi.hoisted(() => vi.fn())
const notifyMock = vi.fn()

vi.mock('update-notifier', () => ({
  default: updateNotifierMock,
}))

describe('notifyUpdates', () => {
  const pkg = { name: '@eljs/generator', version: '2.0.0-beta.0' }

  beforeEach(() => {
    vi.clearAllMocks()
    updateNotifierMock.mockImplementation(() => ({ notify: notifyMock }))
  })

  it('普通命令在后台触发更新通知', async () => {
    notifyUpdates({
      pkg,
      argv: ['node', 'create', 'template', 'project'],
    })

    await vi.waitFor(() => {
      expect(updateNotifierMock).toHaveBeenCalledWith({ pkg })
      expect(notifyMock).toHaveBeenCalledOnce()
    })
  })

  it('帮助与版本查询跳过更新检查', async () => {
    for (const argument of ['-h', '--help', '-v', '--version']) {
      notifyUpdates({ pkg, argv: ['node', 'create', argument] })
    }

    await new Promise(resolve => setTimeout(resolve, 10))
    expect(updateNotifierMock).not.toHaveBeenCalled()
  })

  it('加载失败时记录 debug 且不抛出', async () => {
    const debug = vi.fn()
    const error = new Error('Load failed')
    updateNotifierMock.mockImplementationOnce(() => {
      throw error
    })

    notifyUpdates({ pkg, argv: ['node', 'create', 'project'], debug })

    await vi.waitFor(() =>
      expect(debug).toHaveBeenCalledWith(
        'update notification failed:%O',
        error,
      ),
    )
  })

  it('未提供 debug 时静默吞掉更新检查失败', async () => {
    updateNotifierMock.mockImplementationOnce(() => {
      throw new Error('Load failed')
    })

    notifyUpdates({ pkg, argv: ['node', 'create', 'project'] })

    await new Promise(resolve => setTimeout(resolve, 10))
  })
})
