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

  it('缺失标准输出时不把标签判为当前提交', async () => {
    ;(run as MockedFunction<typeof run>)
      .mockResolvedValueOnce({
        stdout: undefined,
      } as Awaited<ReturnType<typeof run>>)
      .mockResolvedValueOnce({
        stdout: 'abc123',
      } as Awaited<ReturnType<typeof run>>)

    await expect(isGitTagAtHead('v1.0.0')).resolves.toBe(false)
  })

  it('缺失标签输出时给出文本解析错误', async () => {
    ;(run as MockedFunction<typeof run>).mockResolvedValueOnce({
      stdout: undefined,
    } as Awaited<ReturnType<typeof run>>)

    await expect(findRetryVersionAtHead('/repo', false)).rejects.toThrow(
      'Git tag output must be text',
    )
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

  it('统一模式多个不同 HEAD 版本必须拒绝', async () => {
    ;(run as MockedFunction<typeof run>).mockResolvedValue({
      stdout: 'v1.2.3\nv1.10.0\nnot-a-release-tag\nv1.9.2\n',
    } as Awaited<ReturnType<typeof run>>)

    await expect(findRetryVersionAtHead('/repo', false)).rejects.toThrow(
      'Ambiguous release tags',
    )
    expect(run).toHaveBeenCalledWith('git', ['tag', '--points-at', 'HEAD'], {
      cwd: '/repo',
    })
  })

  it('未过滤的独立标签多个不同版本必须拒绝', async () => {
    ;(run as MockedFunction<typeof run>).mockResolvedValue({
      stdout: '@scope/pkg-a@2.0.0\npkg-b@2.1.0\nv1.0.0\n',
    } as Awaited<ReturnType<typeof run>>)

    await expect(findRetryVersionAtHead('/repo', true)).rejects.toThrow(
      'Ambiguous release tags',
    )
  })

  it('过滤当前包并支持 scoped、同版本多标签和 partial 标签', async () => {
    vi.mocked(run).mockResolvedValue({
      stdout: '@scope/pkg-a@2.0.0\npkg-b@2.0.0\nunrelated@9.0.0\n',
    } as Awaited<ReturnType<typeof run>>)
    await expect(
      findRetryVersionAtHead('/repo', true, undefined, [
        '@scope/pkg-a',
        'pkg-b',
      ]),
    ).resolves.toBe('2.0.0')
    await expect(
      findRetryVersionAtHead('/repo', true, undefined, ['@scope/pkg-a']),
    ).resolves.toBe('2.0.0')
    await expect(
      findRetryVersionAtHead('/repo', true, undefined, []),
    ).resolves.toBeUndefined()
  })

  it('过滤后当前包混合版本仍必须拒绝', async () => {
    vi.mocked(run).mockResolvedValue({
      stdout: '@scope/a@1.0.0\nb@2.0.0\nunrelated@9.0.0\n',
    } as Awaited<ReturnType<typeof run>>)
    await expect(
      findRetryVersionAtHead('/repo', true, undefined, ['@scope/a', 'b']),
    ).rejects.toThrow('Ambiguous release tags')
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
      stdout: 'v2.0.0-01\npkg@latest\nv2.0.0-rc.1\n',
    } as Awaited<ReturnType<typeof run>>)

    await expect(findRetryVersionAtHead('/repo', false)).resolves.toBe(
      '2.0.0-rc.1',
    )
  })
})
