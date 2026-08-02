import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest'

import { run } from '@eljs/utils'

import { isGitTagAtHead } from '../../src/utils/git'

vi.mock('@eljs/utils', () => ({
  run: vi.fn(),
}))
vi.mock('@eljs/utils/cp', async () => import('@eljs/utils'))

describe('release Git 工具', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('标签指向当前提交时应该返回 true', async () => {
    ;(run as MockedFunction<typeof run>)
      .mockResolvedValueOnce({
        stdout: 'abc123\n',
      } as Awaited<ReturnType<typeof run>>)
      .mockResolvedValueOnce({
        stdout: 'abc123\n',
      } as Awaited<ReturnType<typeof run>>)

    await expect(isGitTagAtHead('v1.0.0')).resolves.toBe(true)
    expect(run).toHaveBeenNthCalledWith(
      1,
      'git',
      ['rev-list', '-n', '1', 'v1.0.0'],
      undefined,
    )
    expect(run).toHaveBeenNthCalledWith(
      2,
      'git',
      ['rev-parse', 'HEAD'],
      undefined,
    )
  })

  it('标签指向其他提交或不存在时应该返回 false', async () => {
    ;(run as MockedFunction<typeof run>)
      .mockResolvedValueOnce({
        stdout: 'abc123',
      } as Awaited<ReturnType<typeof run>>)
      .mockResolvedValueOnce({
        stdout: 'def456',
      } as Awaited<ReturnType<typeof run>>)

    await expect(isGitTagAtHead('v1.0.0')).resolves.toBe(false)

    ;(run as MockedFunction<typeof run>).mockRejectedValueOnce(
      new Error('unknown revision'),
    )

    await expect(isGitTagAtHead('v2.0.0')).resolves.toBe(false)
  })
})
