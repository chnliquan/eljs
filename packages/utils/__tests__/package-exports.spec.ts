import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import * as rootExports from '../src'
import * as pathExports from '../src/path'

interface PackageManifest {
  exports: Record<string, unknown>
  sideEffects?: boolean
}

describe('package exports contract', () => {
  it('only exposes the root and documented domain entry points', async () => {
    const manifest = JSON.parse(
      await readFile(path.resolve('packages/utils/package.json'), 'utf8'),
    ) as PackageManifest

    expect(Object.keys(manifest.exports)).toEqual([
      '.',
      './cli',
      './cp',
      './env',
      './error',
      './file',
      './generator',
      './git',
      './guards',
      './http',
      './logger',
      './module',
      './npm',
      './object',
      './path',
      './promise',
      './string',
      './types',
      './package.json',
    ])
    expect(manifest.exports).not.toHaveProperty('./file/loader')
    expect(manifest.exports).not.toHaveProperty('./*')
    expect(manifest.sideEffects).toBe(false)
  })

  it('provides ESM, CommonJS and type targets for every domain', async () => {
    const manifest = JSON.parse(
      await readFile(path.resolve('packages/utils/package.json'), 'utf8'),
    ) as PackageManifest

    for (const [entry, target] of Object.entries(manifest.exports)) {
      if (entry === './package.json') {
        continue
      }

      expect(target, entry).toMatchObject({
        import: {
          default: expect.stringMatching(/\.js$/),
          types: expect.stringMatching(/\.d\.ts$/),
        },
        require: {
          default: expect.stringMatching(/\.cjs$/),
          types: expect.stringMatching(/\.d\.cts$/),
        },
      })
    }
  })

  it('does not proxy unrelated third-party packages from the root entry', () => {
    const removedThirdPartyExports = [
      'ejs',
      'glob',
      'importFresh',
      'ini',
      'Mustache',
      'resolve',
      'rimraf',
      'urllib',
      'uuidv1',
      'uuidv3',
      'uuidv4',
      'uuidv5',
      'yaml',
    ]

    for (const exportName of removedThirdPartyExports) {
      expect(rootExports).not.toHaveProperty(exportName)
    }
  })

  it('does not expose removed compatibility aliases', () => {
    const removedRootAliases = [
      'copyTpl',
      'copyTplSync',
      'downloadGitRepository',
      'extractCallDir',
      'fstat',
      'fstatSync',
      'getExecutableCommand',
      'getPid',
      'getWorkspaces',
      'gitUrlAnalysis',
      'isPathExists',
      'isPathExistsSync',
      'parseCommand',
      'pkgNameAnalysis',
      'runCommand',
      'safeWriteFile',
      'safeWriteFileSync',
      'safeWriteJson',
      'safeWriteJsonSync',
      'tmpdir',
      'tmpdirSync',
      'tryPaths',
      'tryPathsSync',
      'winPath',
    ]

    for (const exportName of removedRootAliases) {
      expect(rootExports).not.toHaveProperty(exportName)
    }

    expect(pathExports).not.toHaveProperty('getWorkspaces')
  })
})
