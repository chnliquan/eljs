import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { pathExistsSync } from '@eljs/utils'

import {
  resolveDeclaredPackageManager,
  resolvePackageManagerVariant,
} from '../../src/internal/package-manager'
import type { ProjectPackageJson } from '../../src/types'

vi.mock('@eljs/utils', () => ({
  pathExistsSync: vi.fn(),
}))
vi.mock('@eljs/utils/file', async () => import('@eljs/utils'))

describe('发布包管理器变体解析', () => {
  const projectPkg: ProjectPackageJson = {
    name: 'test-project',
    version: '1.0.0',
  }

  beforeEach(() => {
    vi.mocked(pathExistsSync).mockReturnValue(false)
  })

  it.each([
    ['npm@11.5.0', 'npm'],
    ['pnpm@11.17.0+sha512.deadbeef', 'pnpm'],
    ['yarn@4.9.2', 'yarn'],
    ['bun@1.3.3', 'bun'],
  ] as const)('应该从根清单声明 %s 解析 %s', (declaration, expected) => {
    expect(
      resolveDeclaredPackageManager({
        ...projectPkg,
        packageManager: declaration,
      }),
    ).toBe(expected)
  })

  it('应该忽略无效或不支持的根清单声明', () => {
    expect(
      resolveDeclaredPackageManager({
        ...projectPkg,
        packageManager: 'other@1.0.0',
      }),
    ).toBeUndefined()
    expect(
      resolveDeclaredPackageManager({
        ...projectPkg,
        packageManager: 'bun@',
      }),
    ).toBeUndefined()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it.each(['npm', 'pnpm', 'bun'] as const)(
    '应该直接保留 %s 变体',
    packageManager => {
      expect(
        resolvePackageManagerVariant(packageManager, '/project', projectPkg),
      ).toBe(packageManager)
      expect(pathExistsSync).not.toHaveBeenCalled()
    },
  )

  it('应该通过 packageManager 字段识别 Yarn Classic', () => {
    expect(
      resolvePackageManagerVariant('yarn', '/project', {
        ...projectPkg,
        packageManager: 'yarn@1.22.22',
      }),
    ).toBe('yarn-classic')
  })

  it('应该通过 packageManager 字段识别 Yarn Berry', () => {
    expect(
      resolvePackageManagerVariant('yarn', '/project', {
        ...projectPkg,
        packageManager: 'yarn@4.9.2+sha512.deadbeef',
      }),
    ).toBe('yarn-berry')
  })

  it('应该兼容 Yarn Berry 的非数字别名', () => {
    expect(
      resolvePackageManagerVariant('yarn', '/project', {
        ...projectPkg,
        packageManager: 'yarn@berry',
      }),
    ).toBe('yarn-berry')
  })

  it('没有有效声明时应该通过 .yarnrc.yml 识别 Yarn Berry', () => {
    vi.mocked(pathExistsSync).mockReturnValue(true)

    expect(resolvePackageManagerVariant('yarn', '/project', projectPkg)).toBe(
      'yarn-berry',
    )
    expect(pathExistsSync).toHaveBeenCalledWith('/project/.yarnrc.yml')
  })

  it('没有 Berry 信号时应该回退到 Yarn Classic', () => {
    expect(resolvePackageManagerVariant('yarn', '/project', projectPkg)).toBe(
      'yarn-classic',
    )
  })
})
