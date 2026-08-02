import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import which from 'which'

import { findExecutable } from '../../src/cp/command'

vi.mock('which')

describe('可执行命令跨平台解析', () => {
  const mockWhich = vi.mocked(which)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该让 which 使用当前平台的 PATH 分隔符', async () => {
    const dirs = ['first-bin', 'second-bin']
    mockWhich.mockResolvedValue('second-bin/tool')

    await expect(findExecutable('tool', dirs)).resolves.toBe('second-bin/tool')
    expect(mockWhich).toHaveBeenCalledWith('tool', {
      path: dirs.join(path.delimiter),
      nothrow: true,
    })
  })

  it('应该保留系统 PATH 和 PATHEXT 的默认查找行为', async () => {
    mockWhich.mockResolvedValue(null as never)

    await expect(findExecutable('missing-tool')).resolves.toBeNull()
    expect(mockWhich).toHaveBeenCalledWith('missing-tool', { nothrow: true })
  })

  it('新名称应该返回可执行文件路径', async () => {
    mockWhich.mockResolvedValue('/usr/local/bin/tool')

    await expect(findExecutable('tool')).resolves.toBe('/usr/local/bin/tool')
  })
})
