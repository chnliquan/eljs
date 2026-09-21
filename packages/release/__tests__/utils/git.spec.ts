import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest'

import { run } from '@eljs/utils'

import { findRetryVersionAtHead, isGitTagAtHead } from '../../src/utils/git'

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

  it('不应该把取消误判为标签不存在', async () => {
    const controller = new AbortController()
    const cancellation = new Error('cancelled')
    controller.abort(cancellation)
    ;(run as MockedFunction<typeof run>).mockRejectedValue(
      new Error('terminated'),
    )

    await expect(
      isGitTagAtHead('v1.0.0', { signal: controller.signal }),
    ).rejects.toBe(cancellation)
  })

  it('findRetryVersionAtHead 应该返回指向 HEAD 的最大统一标签版本', async () => {
    ;(run as MockedFunction<typeof run>).mockResolvedValue({
      stdout: 'v1.2.3\nv1.10.0\nnot-a-release-tag\nv1.9.2\n',
    } as Awaited<ReturnType<typeof run>>)

    await expect(findRetryVersionAtHead('/repo', false)).resolves.toBe('1.10.0')
    expect(run).toHaveBeenCalledWith('git', ['tag', '--points-at', 'HEAD'], {
      cwd: '/repo',
    })
  })

  it('findRetryVersionAtHead 应该解析独立标签并取最大版本', async () => {
    ;(run as MockedFunction<typeof run>).mockResolvedValue({
      stdout: '@scope/pkg-a@2.0.0\npkg-b@2.1.0\nv1.0.0\n',
    } as Awaited<ReturnType<typeof run>>)

    await expect(findRetryVersionAtHead('/repo', true)).resolves.toBe('2.1.0')
  })

  it('findRetryVersionAtHead 无匹配标签时应该返回 undefined', async () => {
    ;(run as MockedFunction<typeof run>).mockResolvedValue({
      stdout: 'not-a-release-tag\nsome-other\n',
    } as Awaited<ReturnType<typeof run>>)

    await expect(
      findRetryVersionAtHead('/repo', false),
    ).resolves.toBeUndefined()
  })

  it('findRetryVersionAtHead 应该跳过非法版本片段', async () => {
    ;(run as MockedFunction<typeof run>).mockResolvedValue({
      stdout: 'v2.0.0-notsemver\npkg@latest\nv2.0.0-rc.1\n',
    } as Awaited<ReturnType<typeof run>>)

    await expect(findRetryVersionAtHead('/repo', false)).resolves.toBe(
      '2.0.0-rc.1',
    )
  })
})
