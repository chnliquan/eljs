import { existsSync, mkdtempSync } from 'node:fs'
import { expect, it, vi } from 'vitest'

vi.mock('node:fs', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs')>()
  return { ...fs, mkdtempSync: vi.fn(fs.mkdtempSync) }
})

it('校验命令超时时停止后续命令并清理临时目录', async () => {
  const command = vi.fn(() => {
    throw new Error('Package verification command timed out after 300000 ms')
  })
  // 仅替换命令执行边界，实际目录创建和 finally 清理仍由校验脚本执行
  vi.doMock('../package-check-command', () => ({
    runPackageCheckCommand: command,
  }))
  try {
    await expect(import('../check-packages')).rejects.toThrow('timed out')
    expect(command).toHaveBeenCalledTimes(1)
    const directory = vi.mocked(mkdtempSync).mock.results[0].value as string
    expect(directory).toEqual(expect.stringContaining('eljs-package-smoke-'))
    expect(existsSync(directory)).toBe(false)
  } finally {
    vi.doUnmock('../package-check-command')
  }
})
