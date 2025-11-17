/**
 * @file 测试工具函数
 * @description 为测试提供公共工具和模拟设置
 */

import type { PackageJson } from '@eljs/utils'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 创建临时测试目录和 package.json
 */
export async function createTempProject(
  packageJson: Partial<PackageJson> = {},
): Promise<{
  tempDir: string
  cleanup: () => Promise<void>
}> {
  const tempDir = await mkdtemp(join(tmpdir(), 'release-it-'))

  const defaultPackageJson: PackageJson = {
    name: 'it-package',
    version: '1.0.0',
    description: 'it package for release iting',
    main: 'index.js',
    scripts: {},
    keywords: [],
    author: 'it Author',
    license: 'MIT',
    ...packageJson,
  }

  await writeFile(
    join(tempDir, 'package.json'),
    JSON.stringify(defaultPackageJson, null, 2),
  )

  const cleanup = async () => {
    try {
      await rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      // 忽略清理错误
    }
  }

  return { tempDir, cleanup }
}

/**
 * 创建模拟的 AppData
 */
export function createMockAppData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overrides: Record<string, any> = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  return {
    cliVersion: '1.0.0',
    registry: 'https://registry.npmjs.org',
    branch: 'main',
    latestTag: 'v1.0.0',
    projectPkgJsonPath: '/it/package.json',
    projectPkg: {
      name: 'it-project',
      version: '1.0.0',
      description: 'it project',
      main: 'index.js',
      scripts: {},
      keywords: [],
      author: 'it Author',
      license: 'MIT',
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
      optionalDependencies: {},
      bundledDependencies: [],
      engines: {},
      os: [],
      cpu: [],
      private: false,
      homepage: '',
      bugs: { url: '' },
      repository: { type: 'git', url: '' },
      funding: '',
      files: [],
      bin: {},
      man: [],
      directories: {},
      config: {},
      publishConfig: {},
    },
    pkgJsonPaths: ['/it/package.json'],
    pkgs: [],
    pkgNames: ['it-project'],
    validPkgRootPaths: ['/it'],
    validPkgNames: ['it-project'],
    packageManager: 'npm',
    ...overrides,
  }
}
