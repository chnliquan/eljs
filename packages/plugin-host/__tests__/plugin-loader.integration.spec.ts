import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PluginHostErrorCode, PluginKind } from '../src'
import { loadPluginInitializer } from '../src/plugin/plugin-loader'

const localRequire = createRequire(import.meta.url)

describe('TypeScript 插件语法边界', () => {
  let cwd: string
  let previousTs: NodeJS.RequireExtensions[string] | undefined
  let previousCts: NodeJS.RequireExtensions[string] | undefined

  beforeEach(async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-plugin-syntax-'))
    previousTs = localRequire.extensions['.ts']
    previousCts = localRequire.extensions['.cts']
  })

  afterEach(async () => {
    expect(localRequire.extensions['.ts']).toBe(previousTs)
    expect(localRequire.extensions['.cts']).toBe(previousCts)
    await rm(cwd, { recursive: true, force: true })
  })

  it.each(['.ts', '.cts'])(
    '拒绝可被转译为合法 JS 的 %s 语法错误且不执行模块',
    async extension => {
      const entry = path.join(cwd, `broken${extension}`)
      const marker = path.join(cwd, 'executed')
      await writeFile(
        entry,
        [
          `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ran')`,
          'const broken: = 1',
          'export default () => {}',
        ].join('\n'),
      )

      await expect(
        loadPluginInitializer(entry, PluginKind.Plugin),
      ).rejects.toMatchObject({
        code: PluginHostErrorCode.PluginLoadFailed,
        cause: expect.objectContaining({
          name: 'SyntaxError',
          message: expect.stringContaining(`${entry}: Type expected.`),
        }),
      })
      await expect(readFile(marker)).rejects.toMatchObject({ code: 'ENOENT' })

      const valid = path.join(cwd, `valid${extension}`)
      await writeFile(valid, 'export default () => 42')
      await expect(
        loadPluginInitializer(valid, PluginKind.Plugin),
      ).resolves.toEqual(expect.any(Function))
    },
  )

  it.each(['.ts', '.cts'])(
    '检查相对 %s 依赖并提供实际失败路径',
    async extension => {
      const entry = path.join(cwd, 'entry.ts')
      const dependency = path.join(cwd, `helper${extension}`)
      const marker = path.join(cwd, 'dependency-executed')
      await writeFile(
        entry,
        `import { value } from './helper${extension}'; export default () => value`,
      )
      await writeFile(
        dependency,
        [
          `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ran')`,
          'export const value: = 1',
        ].join('\n'),
      )
      await expect(
        loadPluginInitializer(entry, PluginKind.Plugin),
      ).rejects.toMatchObject({
        code: PluginHostErrorCode.PluginLoadFailed,
        cause: expect.objectContaining({
          message: expect.stringContaining(dependency),
        }),
      })
      await expect(readFile(marker)).rejects.toMatchObject({ code: 'ENOENT' })
    },
  )

  it('只做语法检查且在执行异常后恢复 Hook', async () => {
    const valid = path.join(cwd, 'type-error.ts')
    await writeFile(
      valid,
      "const value: number = 'no type check'; export default () => value",
    )
    await expect(
      loadPluginInitializer(valid, PluginKind.Plugin),
    ).resolves.toEqual(expect.any(Function))

    const failing = path.join(cwd, 'execution-error.cts')
    await writeFile(failing, "throw new Error('execution failed')")
    await expect(
      loadPluginInitializer(failing, PluginKind.Plugin),
    ).rejects.toMatchObject({
      code: PluginHostErrorCode.PluginLoadFailed,
      cause: expect.objectContaining({
        message: expect.stringContaining('execution failed'),
      }),
    })
  })

  it('语法失败后保留应用已经安装的 TypeScript Hook', async () => {
    const priorLoader: NodeJS.RequireExtensions[string] = () => {
      throw new Error('prior loader should not execute')
    }
    const entry = path.join(cwd, 'invalid-with-hook.ts')
    await writeFile(entry, 'const broken: = 1; export default () => {}')
    localRequire.extensions['.ts'] = priorLoader
    localRequire.extensions['.cts'] = priorLoader

    try {
      await expect(
        loadPluginInitializer(entry, PluginKind.Plugin),
      ).rejects.toMatchObject({ code: PluginHostErrorCode.PluginLoadFailed })
      expect(localRequire.extensions['.ts']).toBe(priorLoader)
      expect(localRequire.extensions['.cts']).toBe(priorLoader)
    } finally {
      for (const [extension, loader] of [
        ['.ts', previousTs],
        ['.cts', previousCts],
      ] as const) {
        if (loader) {
          localRequire.extensions[extension] = loader
        } else {
          delete localRequire.extensions[extension]
        }
      }
    }
  })
})
