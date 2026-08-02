import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

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
})
