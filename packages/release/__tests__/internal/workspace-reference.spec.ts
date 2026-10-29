import { describe, expect, it } from 'vitest'

import { createPublishPlan } from '../../src/internal/publish-plan'
import { prepareVersionPlan } from '../../src/internal/version-plan'
import { resolveWorkspaceReference } from '../../src/internal/workspace-reference'
import type { WorkspacePackage } from '../../src/types'

function pkg(
  name: string,
  dependencies: Record<string, string> = {},
  privatePackage = false,
): WorkspacePackage {
  const rootPath = `/fixture/${name.replace('@scope/', '')}`
  return {
    rootPath,
    manifestPath: `${rootPath}/package.json`,
    manifest: { name, version: '1.1.0', dependencies, private: privatePackage },
  }
}

describe('共享 workspace 目标解析契约', () => {
  it.each([
    'workspace:core@*',
    'workspace:core@^',
    'workspace:core@~',
    'workspace:core@^1.0.0',
    'workspace:../core',
    'workspace:./../core',
  ])('别名 %s 按实际目标排序且版本更新保留协议语义', async reference => {
    const workspacePackages = [pkg('app', { alias: reference }), pkg('core')]
    const appData = {
      workspacePackages,
      projectPkg: { name: 'root', version: '1.0.0' },
      projectPkgJsonPath: '/fixture/package.json',
    }
    const plan = await prepareVersionPlan(appData, '1.1.0')
    const value = plan.workspacePackages[0].manifest.dependencies?.alias
    expect(value).toBe(
      reference === 'workspace:core@^1.0.0'
        ? 'workspace:core@1.1.0'
        : reference,
    )
    expect(createPublishPlan(plan, '1.1.0').map(target => target.name)).toEqual(
      ['core', 'app'],
    )
    expect(workspacePackages[0].manifest.dependencies?.alias).toBe(reference)
  })

  it('scoped alias 覆盖四类依赖且保留具名协议前缀', async () => {
    const workspacePackages = [pkg('app'), pkg('@scope/core')]
    const manifest = workspacePackages[0].manifest
    manifest.dependencies = { alias: 'workspace:@scope/core@^1.0.0' }
    manifest.devDependencies = { dev: 'workspace:@scope/core@*' }
    manifest.optionalDependencies = { optional: 'workspace:@scope/core@~1.0.0' }
    manifest.peerDependencies = { peer: 'workspace:@scope/core@^' }
    const plan = await prepareVersionPlan(
      {
        workspacePackages,
        projectPkg: { version: '1.0.0' },
        projectPkgJsonPath: '/fixture/package.json',
      },
      '1.1.0',
    )
    expect(plan.workspacePackages[0].manifest).toMatchObject({
      dependencies: { alias: 'workspace:@scope/core@1.1.0' },
      devDependencies: { dev: 'workspace:@scope/core@*' },
      optionalDependencies: { optional: 'workspace:@scope/core@1.1.0' },
      peerDependencies: { peer: 'workspace:@scope/core@^' },
    })
    expect(createPublishPlan(plan, '1.1.0').map(target => target.name)).toEqual(
      ['@scope/core', 'app'],
    )
  })

  it.each(['workspace:core@*', 'workspace:../core'])(
    '%s 不得隐藏 private 运行时目标或循环',
    reference => {
      expect(() =>
        createPublishPlan(
          {
            workspacePackages: [
              pkg('app', { alias: reference }),
              pkg('core', {}, true),
            ],
          },
          '1.1.0',
        ),
      ).toThrow('non-publishable workspace package core')
      expect(() =>
        createPublishPlan(
          {
            workspacePackages: [
              pkg('app', { alias: reference }),
              pkg('core', { alias: 'workspace:app@*' }),
            ],
          },
          '1.1.0',
        ),
      ).toThrow('circular runtime dependency')
    },
  )

  it('开发和 peer 引用 private 包不进入运行时图，optional 引用仍受约束', () => {
    const app = pkg('app')
    app.manifest.devDependencies = { dev: 'workspace:core@*' }
    app.manifest.peerDependencies = { peer: 'workspace:core@*' }
    const workspacePackages = [app, pkg('core', {}, true)]
    expect(
      createPublishPlan({ workspacePackages }, '1.1.0').map(
        target => target.name,
      ),
    ).toEqual(['app'])
    app.manifest.optionalDependencies = { optional: 'workspace:core@*' }
    expect(() => createPublishPlan({ workspacePackages }, '1.1.0')).toThrow(
      'non-publishable',
    )
  })

  it.each([
    'workspace:missing@*',
    'workspace:@scope/missing@^',
    'workspace:../missing',
    'workspace:',
    'workspace:core@bad',
    'workspace:/fixture/core',
    'workspace:core@',
    'workspace:core@ *',
  ])('图与版本预演一致拒绝无法安全解析的 %s', async reference => {
    const workspacePackages = [pkg('app', { alias: reference }), pkg('core')]
    expect(() => createPublishPlan({ workspacePackages }, '1.1.0')).toThrow(
      'Invalid workspace protocol',
    )
    await expect(
      prepareVersionPlan(
        {
          workspacePackages,
          projectPkg: { version: '1.0.0' },
          projectPkgJsonPath: '/fixture/package.json',
        },
        '1.1.0',
      ),
    ).rejects.toThrow('Invalid workspace protocol')
  })

  it('相对路径无目录映射或命中多个包时拒绝猜测', () => {
    expect(() =>
      resolveWorkspaceReference('alias', 'workspace:../core', {
        packageNames: ['core'],
      }),
    ).toThrow('Invalid workspace protocol')
    expect(() =>
      resolveWorkspaceReference('alias', 'workspace:../core', {
        packageNames: ['core', 'other'],
        rootPath: '/fixture/app',
        packages: [pkg('core'), { ...pkg('other'), rootPath: '/fixture/core' }],
      }),
    ).toThrow('Invalid workspace protocol')
  })
})
