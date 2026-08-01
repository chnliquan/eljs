import { safeWriteJson, type PackageJson } from '@eljs/utils'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest'

import {
  prepareVersionPlan,
  rollbackVersionPlan,
  writeVersionPlan,
} from '../../src/internal/version-plan'
import type { AppData } from '../../src/types'

vi.mock('@eljs/utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@eljs/utils')>()
  return {
    ...actual,
    safeWriteJson: vi.fn(),
  }
})

describe('版本清单两阶段更新计划', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(safeWriteJson as MockedFunction<typeof safeWriteJson>).mockResolvedValue()
  })

  it('应该在内存中完成全部清单更新且不修改输入对象', async () => {
    const appData = createAppData()

    const plan = await prepareVersionPlan(appData, '2.0.0')

    expect(appData.pkgs[0].version).toBe('1.0.0')
    expect(appData.pkgs[1].dependencies?.core).toBe('workspace:^')
    expect(plan.pkgs[0].version).toBe('2.0.0')
    expect(plan.pkgs[1].dependencies?.core).toBe('workspace:^')
    expect(plan.projectPkg.version).toBe('2.0.0')
    expect(safeWriteJson).not.toHaveBeenCalled()
  })

  it('任一清单校验失败时不应该修改输入对象或写入文件', async () => {
    const appData = createAppData()
    appData.pkgs[1].dependencies = { core: 'workspace:invalid range' }

    await expect(prepareVersionPlan(appData, '2.0.0')).rejects.toThrow(
      'Invalid workspace protocol',
    )

    expect(appData.pkgs[0].version).toBe('1.0.0')
    expect(appData.pkgs[1].version).toBe('1.0.0')
    expect(safeWriteJson).not.toHaveBeenCalled()
  })

  it('写入失败时应该恢复本次已经写入的清单', async () => {
    const plan = await prepareVersionPlan(createAppData(), '2.0.0')
    ;(safeWriteJson as MockedFunction<typeof safeWriteJson>)
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValueOnce()

    await expect(writeVersionPlan(plan)).rejects.toThrow('disk full')

    expect(safeWriteJson).toHaveBeenNthCalledWith(
      1,
      '/repo/core/package.json',
      expect.objectContaining({ version: '2.0.0' }),
    )
    expect(safeWriteJson).toHaveBeenNthCalledWith(
      3,
      '/repo/core/package.json',
      expect.objectContaining({ version: '1.0.0' }),
    )
  })

  it('写入和回滚同时失败时应该保留全部错误', async () => {
    const plan = await prepareVersionPlan(createAppData(), '2.0.0')
    ;(safeWriteJson as MockedFunction<typeof safeWriteJson>)
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('disk full'))
      .mockRejectedValueOnce(new Error('rollback failed'))

    const error = await writeVersionPlan(plan).catch(value => value)

    expect(error).toBeInstanceOf(AggregateError)
    expect((error as AggregateError).errors).toHaveLength(2)
  })

  it('应该支持在锁文件更新失败后恢复全部清单', async () => {
    const plan = await prepareVersionPlan(createAppData(), '2.0.0')

    await rollbackVersionPlan(plan)

    expect(safeWriteJson).toHaveBeenCalledTimes(3)
    expect(safeWriteJson).toHaveBeenCalledWith(
      '/repo/core/package.json',
      expect.objectContaining({ version: '1.0.0' }),
    )
    expect(safeWriteJson).toHaveBeenCalledWith(
      '/repo/app/package.json',
      expect.objectContaining({ version: '1.0.0' }),
    )
    expect(safeWriteJson).toHaveBeenCalledWith(
      '/repo/package.json',
      expect.objectContaining({ version: '1.0.0' }),
    )
  })
})

function createAppData(): AppData {
  const projectPkg: PackageJson & { version: string } = {
    name: 'project',
    version: '1.0.0',
  }

  return {
    branch: 'main',
    cliVersion: '1.0.0',
    latestTag: null,
    packageManager: 'pnpm',
    packageManagerVariant: 'pnpm',
    pkgJsonPaths: ['/repo/core/package.json', '/repo/app/package.json'],
    pkgNames: ['core', 'app'],
    pkgs: [
      { name: 'core', version: '1.0.0' },
      {
        name: 'app',
        version: '1.0.0',
        dependencies: { core: 'workspace:^' },
      },
    ],
    projectPkg,
    projectPkgJsonPath: '/repo/package.json',
    validPkgNames: ['core', 'app'],
    validPkgRootPaths: ['/repo/core', '/repo/app'],
  }
}
