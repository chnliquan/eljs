import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * @file 真实 commander 解析链路的集成冒烟测试
 * @description 不 mock commander 解析行为，验证点分选项、否定前缀、
 * value-source 过滤与解析层参数校验的真实语义
 */

vi.mock('update-notifier', () => ({ default: vi.fn() }))
vi.mock('../src/release', () => ({ release: vi.fn() }))
vi.mock('../src/utils', () => ({
  AppError: class AppError extends Error {},
}))

import type { MockedFunction } from 'vitest'
import { createProgram } from '../src/cli'
import { release } from '../src/release'

const runCommand = async (args: string[]): Promise<void> => {
  const exit = vi
    .spyOn(process, 'exit')
    .mockImplementation((() => undefined) as never)
  try {
    await createProgram('1.0.0').parseAsync(['node', 'release', ...args])
  } finally {
    exit.mockRestore()
  }
}

const capturedOptions = (): Record<string, unknown> | undefined =>
  (release as MockedFunction<typeof release>).mock.calls[0]?.[1] as
    Record<string, unknown> | undefined

describe('真实 commander 解析链路', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = undefined
  })

  it('未传 flag 时不向 release 传递任何 git/npm/github 键', async () => {
    await runCommand(['minor'])
    const options = capturedOptions()
    expect(options).not.toHaveProperty('git')
    expect(options).not.toHaveProperty('npm')
    expect(options).not.toHaveProperty('github')
  })

  it('否定 flag 递归展开到嵌套路径', async () => {
    await runCommand(['--no-git.push'])
    expect(capturedOptions()?.git).toEqual({ push: false })
  })

  it('正形式 --git.push 显式传递 true', async () => {
    await runCommand(['--git.push'])
    expect(capturedOptions()?.git).toEqual({ push: true })
  })

  it('--no-npm.canary 关闭 canary', async () => {
    await runCommand(['--no-npm.canary'])
    expect(capturedOptions()?.npm).toEqual({ canary: false })
  })

  it('--no-git.independent 关闭独立标签', async () => {
    await runCommand(['--no-git.independent'])
    expect(capturedOptions()?.git).toEqual({ independent: false })
  })

  it('值选项传递字符串', async () => {
    await runCommand(['--npm.registry', 'https://registry.example.com'])
    expect(capturedOptions()?.npm).toEqual({
      registry: 'https://registry.example.com',
    })
  })

  it('同键正反形式 last-one-wins', async () => {
    await runCommand(['--no-git.push', '--git.push'])
    expect(capturedOptions()?.git).toEqual({ push: true })
  })

  it('--github.mode 非法值在解析层报错且不调用 release', async () => {
    await expect(runCommand(['--github.mode', 'gitlab'])).rejects.toThrow()
    expect(release).not.toHaveBeenCalled()
  })

  it('--npm.prereleaseId 非法值在解析层报错且不调用 release', async () => {
    await expect(runCommand(['--npm.prereleaseId', '1.2.3'])).rejects.toThrow()
    expect(release).not.toHaveBeenCalled()
  })
})
