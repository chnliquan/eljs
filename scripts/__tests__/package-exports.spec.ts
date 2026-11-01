import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  assertExportTargets,
  getExportEntries,
  type ExportTarget,
} from '../package-exports'

const formats = {
  import: './dist/esm/nested/public.js',
  require: './dist/cjs/nested/public.cjs',
  types: './dist/types/nested/public.d.ts',
}
const publicFiles = Object.values(formats).map(file => file.replace('./', ''))
const check = (exports: ExportTarget, files: string[]): void =>
  assertExportTargets('@eljs/fixture', exports, new Set(files))

describe('发布 tarball 的具体导出契约', () => {
  it('统一根导出和子路径映射，保留排除项与数组候选', () => {
    expect(getExportEntries(undefined)).toEqual([])
    expect(getExportEntries(null)).toEqual([['.', null]])
    expect(getExportEntries('./dist/index.js')).toEqual([
      ['.', './dist/index.js'],
    ])
    expect(getExportEntries(formats)).toEqual([['.', formats]])
    expect(getExportEntries(['./first.js', './second.js'])).toEqual([
      ['.', ['./first.js', './second.js']],
    ])
    expect(
      getExportEntries({ './public': formats, './private': null }),
    ).toEqual([
      ['./public', formats],
      ['./private', null],
    ])
  })

  it.each(['import', 'require', 'types'] as const)(
    '所有条件目标都必须存在，包括 %s',
    missing => {
      const missingFile = formats[missing].replace('./', '')
      expect(() =>
        check(
          formats,
          publicFiles.filter(file => file !== missingFile),
        ),
      ).toThrow(`is missing ${missingFile}`)
      expect(() => check(formats, publicFiles)).not.toThrow()
    },
  )

  it('严格检查嵌套条件与数组的所有正向候选', () => {
    const exports = {
      './public': {
        node: {
          import: [formats.import, './fallback/public.js', null],
          require: formats.require,
        },
        types: formats.types,
      },
    }
    const files = [...publicFiles, 'fallback/public.js']
    expect(() => check(exports, files)).not.toThrow()
    for (const missingFile of files) {
      expect(() =>
        check(
          exports,
          files.filter(file => file !== missingFile),
        ),
      ).toThrow(`is missing ${missingFile}`)
    }
  })

  it('null 排除项不产生文件要求', () => {
    expect(() => check(null, [])).not.toThrow()
    expect(() => check({ './hidden': null }, [])).not.toThrow()
    expect(() =>
      check({ './public': formats, './hidden': null }, publicFiles),
    ).not.toThrow()
    expect(() =>
      check({ import: formats.import, default: null }, [publicFiles[0]]),
    ).not.toThrow()
  })

  it.each(['./*', './feature/*', './two**'])(
    '包含星号的子路径键明确报不支持错误：%s',
    key => {
      for (const target of [formats, './shared.js', null]) {
        expect(() =>
          check({ [key]: target }, [...publicFiles, 'shared.js']),
        ).toThrow(`@eljs/fixture has unsupported export subpath pattern ${key}`)
      }
    },
  )

  it.each<{ exports: ExportTarget }>([
    { exports: formats.import },
    { exports: [formats.import, null] },
    { exports: { '.': formats.import } },
    { exports: { './public': formats.import } },
  ])('具体导出只接受清单中存在的目标：$exports', ({ exports }) => {
    expect(() => check(exports, publicFiles)).not.toThrow()
    expect(() => check(exports, ['dist/esm/nested/other.js'])).toThrow(
      '@eljs/fixture is missing dist/esm/nested/public.js from its published tarball',
    )
  })

  it('根数组的所有正向目标都必须存在，不模拟回退', () => {
    const exports = ['./first.js', null, './second.js']
    expect(() => check(exports, ['first.js', 'second.js'])).not.toThrow()
    for (const file of ['first.js', 'second.js']) {
      expect(() => check(exports, [file])).toThrow('is missing')
    }
  })

  it.each<{ exports: ExportTarget }>([
    { exports: './dist/*.js' },
    { exports: { import: './dist/*.js' } },
    { exports: ['./dist/*.js', null] },
    { exports: { '.': './dist/*.js' } },
    { exports: { './literal': './dist/*.js' } },
  ])('具体键目标中的星号按字面文件检查：$exports', ({ exports }) => {
    expect(() => check(exports, ['dist/*.js'])).not.toThrow()
    expect(() => check(exports, ['dist/a.js'])).toThrow('is missing dist/*.js')
  })

  it('具体导出中的其他 glob 字符保持字面意义', () => {
    expect(() =>
      check({ '.': ['./dist/[a]?.js', './dist/index.js'], './blocked': null }, [
        'dist/[a]?.js',
        'dist/index.js',
      ]),
    ).not.toThrow()
    expect(() => check('./dist/[a]?.js', ['dist/a1.js'])).toThrow(
      'is missing dist/[a]?.js',
    )
  })

  it('真实离线打包后按 tarball 清单校验，并保留源码与测试排除', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'eljs-export-pack-'))
    try {
      const exports = { './nested/public': formats, './hidden': null }
      writeFileSync(
        path.join(root, 'package.json'),
        JSON.stringify({
          name: 'eljs-export-pack-fixture',
          version: '1.0.0',
          files: ['dist'],
          exports,
        }),
      )
      for (const file of [
        ...publicFiles,
        'dist/esm/hidden.js',
        'src/index.ts',
        '__tests__/index.spec.ts',
      ]) {
        const fullPath = path.join(root, file)
        mkdirSync(path.dirname(fullPath), { recursive: true })
        writeFileSync(fullPath, '')
      }
      const result = spawnSync(
        'npm',
        ['pack', '--json', '--ignore-scripts', '--offline'],
        { cwd: root, encoding: 'utf8', timeout: 20_000 },
      )
      expect(result.error).toBeUndefined()
      expect(result.status, result.stderr).toBe(0)
      const [packed] = JSON.parse(result.stdout) as Array<{
        filename: string
        files: Array<{ path: string }>
      }>
      const tarball = path.join(root, packed.filename)
      expect(existsSync(tarball)).toBe(true)
      const listing = spawnSync('tar', ['-tzf', tarball], {
        encoding: 'utf8',
      })
      expect(listing.status, listing.stderr).toBe(0)
      const files = packed.files.map(file => file.path)
      expect(new Set(listing.stdout.trim().split('\n'))).toEqual(
        new Set(files.map(file => `package/${file}`)),
      )
      expect(files.some(file => /^(src|__tests__)\//u.test(file))).toBe(false)
      const manifest = JSON.parse(
        readFileSync(path.join(root, 'package.json'), 'utf8'),
      ) as { exports: ExportTarget }
      expect(() => check(manifest.exports, files)).not.toThrow()
      expect(() =>
        check(
          {
            ...exports,
            './hidden': {
              import: './dist/esm/hidden.js',
              require: './dist/cjs/hidden.cjs',
            },
          },
          files,
        ),
      ).toThrow('is missing dist/cjs/hidden.cjs')
      expect(() => check('./src/index.ts', files)).toThrow(
        'is missing src/index.ts',
      )
      expect(() => check('./__tests__/index.spec.ts', files)).toThrow(
        'is missing __tests__/index.spec.ts',
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)
})
