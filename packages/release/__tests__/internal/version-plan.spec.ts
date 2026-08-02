import { writeJsonAtomic } from '@eljs/utils/file'
import type { PackageJson } from '@eljs/utils/types'
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

vi.mock('@eljs/utils/file', async importOriginal => {
  const actual = await importOriginal<typeof import('@eljs/utils/file')>()
  return {
    ...actual,
    writeJsonAtomic: vi.fn(),
  }
})

describe('版本清单两阶段更新计划', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(
      writeJsonAtomic as MockedFunction<typeof writeJsonAtomic>
    ).mockResolvedValue()
  })

  it('应该在内存中完成全部清单更新且不修改输入对象', async () => {
    const appData = createAppData()

    const plan = await prepareVersionPlan(appData, '2.0.0')

    expect(appData.workspacePackages[0].manifest.version).toBe('1.0.0')
    expect(appData.workspacePackages[1].manifest.dependencies?.core).toBe(
      'workspace:^',
    )
    expect(plan.workspacePackages[0].manifest.version).toBe('2.0.0')
    expect(plan.workspacePackages[1].manifest.dependencies?.core).toBe(
      'workspace:^',
    )
    expect(plan.projectPkg.version).toBe('2.0.0')
    expect(writeJsonAtomic).not.toHaveBeenCalled()
  })

  it('任一清单校验失败时不应该修改输入对象或写入文件', async () => {
    const appData = createAppData()
    appData.workspacePackages[1].manifest.dependencies = {
      core: 'workspace:invalid range',
    }

    await expect(prepareVersionPlan(appData, '2.0.0')).rejects.toThrow(
      'Invalid workspace protocol',
    )

    expect(appData.workspacePackages[0].manifest.version).toBe('1.0.0')
    expect(appData.workspacePackages[1].manifest.version).toBe('1.0.0')
    expect(writeJsonAtomic).not.toHaveBeenCalled()
  })

  it('写入失败时应该恢复本次已经写入的清单', async () => {
    const plan = await prepareVersionPlan(createAppData(), '2.0.0')
    ;(writeJsonAtomic as MockedFunction<typeof writeJsonAtomic>)
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValueOnce()

    await expect(writeVersionPlan(plan)).rejects.toThrow('disk full')

    expect(writeJsonAtomic).toHaveBeenNthCalledWith(
      1,
      '/repo/core/package.json',
      expect.objectContaining({ version: '2.0.0' }),
    )
    expect(writeJsonAtomic).toHaveBeenNthCalledWith(
      3,
      '/repo/core/package.json',
      expect.objectContaining({ version: '1.0.0' }),
    )
  })

  it('写入和回滚同时失败时应该保留全部错误', async () => {
    const plan = await prepareVersionPlan(createAppData(), '2.0.0')
    ;(writeJsonAtomic as MockedFunction<typeof writeJsonAtomic>)
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

    expect(writeJsonAtomic).toHaveBeenCalledTimes(3)
    expect(writeJsonAtomic).toHaveBeenCalledWith(
      '/repo/core/package.json',
      expect.objectContaining({ version: '1.0.0' }),
    )
    expect(writeJsonAtomic).toHaveBeenCalledWith(
      '/repo/app/package.json',
      expect.objectContaining({ version: '1.0.0' }),
    )
    expect(writeJsonAtomic).toHaveBeenCalledWith(
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
    workspacePackages: [
      {
        manifest: { name: 'core', version: '1.0.0' },
        manifestPath: '/repo/core/package.json',
        rootPath: '/repo/core',
      },
      {
        manifest: {
          name: 'app',
          version: '1.0.0',
          dependencies: { core: 'workspace:^' },
        },
        manifestPath: '/repo/app/package.json',
        rootPath: '/repo/app',
      },
    ],
    projectPkg,
    projectPkgJsonPath: '/repo/package.json',
  }
}
