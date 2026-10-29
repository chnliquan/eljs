import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  loadJs,
  loadJsSync,
  loadTs,
  loadTsSync,
  resolveTsConfig,
} from '../../src/loader'
import { Transformer } from '../../src/loader/transformer'

let directory: string
const require = createRequire(import.meta.url)

beforeEach(async () => {
  directory = await realpath(await mkdtemp(join(tmpdir(), 'eljs-loader-')))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe.each([
  { name: '异步 JavaScript', extension: 'cjs', load: loadJs },
  { name: '同步 JavaScript', extension: 'cjs', load: loadJsSync },
  { name: '异步 TypeScript', extension: 'ts', load: loadTs },
  { name: '同步 TypeScript', extension: 'ts', load: loadTsSync },
])('$name 真实模块', ({ extension, load }) => {
  it('应该以 cwd 解析相对路径', async () => {
    const filename = join(directory, `config.${extension}`)
    await writeFile(filename, 'module.exports = { value: 42 }')

    await expect(
      Promise.resolve().then(() => load(relative(process.cwd(), filename))),
    ).resolves.toEqual({ value: 42 })
  })

  it.each([
    { expression: "'string failure'", detail: 'string failure' },
    { expression: 'null', detail: 'null' },
    { expression: 'undefined', detail: 'undefined' },
    {
      expression:
        "Object.freeze(Object.assign(new TypeError('frozen failure'), { code: 'E_CONFIG', errno: 17 }))",
      detail: 'frozen failure',
    },
    {
      expression:
        "Object.defineProperty(new Error('readonly failure'), 'message', { writable: false })",
      detail: 'readonly failure',
    },
  ])('应该保留 $detail 的原因和路径', async ({ expression, detail }) => {
    const filename = join(directory, `throwing.${extension}`)
    const statePath = join(directory, 'state.cjs')
    await writeFile(statePath, 'module.exports = {}')
    await writeFile(
      filename,
      `const state = require('./state.cjs'); state.error = ${expression}; throw state.error`,
    )

    const error = await Promise.resolve()
      .then(() => load(filename))
      .catch((error: unknown) => error)
    const original = require(statePath).error

    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({
      message: `Load ${filename} failed: ${detail}`,
      cause: original,
    })
    expect((error as Error).cause).toBe(original)
    if (detail === 'frozen failure') {
      expect(error).toMatchObject({
        name: 'TypeError',
        code: 'E_CONFIG',
        errno: 17,
      })
      expect(original.message).toBe('frozen failure')
    }
  })

  it('应该保留可修改错误的身份和元数据', async () => {
    const filename = join(directory, `mutable.${extension}`)
    const statePath = join(directory, 'state.cjs')
    await writeFile(statePath, 'module.exports = {}')
    await writeFile(
      filename,
      [
        "const state = require('./state.cjs')",
        "state.error = Object.assign(new RangeError('invalid range'), { code: 'E_RANGE' })",
        'throw state.error',
      ].join('\n'),
    )

    const error = await Promise.resolve()
      .then(() => load(filename))
      .catch((error: unknown) => error)

    expect(error).toBe(require(statePath).error)
    expect(error).toMatchObject({
      message: `Load ${filename} failed: invalid range`,
      code: 'E_RANGE',
    })
  })
})

describe.each([
  { name: '异步', load: loadTs },
  { name: '同步', load: loadTsSync },
])('$name TypeScript 转译', ({ load }) => {
  it('应该拒绝语法错误并在修复后释放 Hook、恢复加载', async () => {
    const filename = join(directory, 'invalid.ts')
    const statePath = join(directory, 'state.cjs')
    await writeFile(statePath, 'module.exports = { executed: false }')
    await writeFile(
      filename,
      "require('./state.cjs').executed = true; export const x: = 1",
    )
    const error = await Promise.resolve()
      .then(() => load(filename))
      .catch((error: unknown) => error)

    expect(error).toBeInstanceOf(SyntaxError)
    expect(error).toMatchObject({
      message: expect.stringContaining(`TypeScript Error in ${filename}`),
    })
    expect((error as Error).message).toContain('Type expected')
    expect(require(statePath).executed).toBe(false)

    await writeFile(filename, 'export const x: number = 1')
    await expect(Promise.resolve().then(() => load(filename))).resolves.toEqual(
      { x: 1 },
    )
  })

  it('应该允许类型不匹配，不执行完整类型检查', async () => {
    const filename = join(directory, 'type-mismatch.ts')
    await writeFile(filename, 'export const x: string = 1')

    await expect(Promise.resolve().then(() => load(filename))).resolves.toEqual(
      { x: 1 },
    )
  })

  it.each([{ include: ['app/**/*'] }, { files: [] }])(
    '应该忽略无输入项目诊断并加载显式根配置：%j',
    async discovery => {
      await mkdir(join(directory, 'app'))
      await writeFile(
        join(directory, 'base.json'),
        JSON.stringify({ compilerOptions: { strict: true } }),
      )
      await writeFile(
        join(directory, 'tsconfig.json'),
        JSON.stringify({ extends: './base.json', ...discovery }),
      )
      const filename = join(directory, 'config.ts')
      await writeFile(filename, 'export const value: number = 42')

      expect(resolveTsConfig(directory).compilerOptions?.strict).toBe(true)
      await expect(
        Promise.resolve().then(() => load(filename)),
      ).resolves.toEqual({ value: 42 })
    },
  )

  it.each([
    '{"compilerOptions":',
    '{"compilerOptions":{"target":"invalid"}}',
    '{"extends":"./missing.json"}',
    '{"include":["app/**/*"],"compilerOptions":{"unknownOption":true}}',
  ])('应该继续拒绝实际配置错误：%s', async config => {
    await writeFile(join(directory, 'tsconfig.json'), config)
    const filename = join(directory, 'config.ts')
    await writeFile(filename, 'export const value = 42')

    await expect(Promise.resolve().then(() => load(filename))).rejects.toThrow(
      `Resolve file ${join(directory, 'tsconfig.json')} failed`,
    )
  })
})

describe('Transformer 真实 require Hook', () => {
  it.each(['string', 'frozen', 'mutable'] as const)(
    '应该安全补充 %s 转换失败的上下文并允许释放 Hook',
    async kind => {
      const original =
        kind === 'string'
          ? 'transform failure'
          : Object.assign(new TypeError('transform failure'), {
              code: 'E_TRANSFORM',
            })
      if (kind === 'frozen') {
        Object.freeze(original)
      }
      const filename = join(directory, 'source.custom')
      await writeFile(filename, 'module.exports = 42')
      const transformer = new Transformer({
        exts: ['.custom'],
        transform: () => {
          throw original
        },
      })
      const dispose = transformer.apply()
      try {
        let caught: unknown
        try {
          require(filename)
        } catch (error) {
          caught = error
        }
        expect(caught).toMatchObject({
          message: `Transform ${filename} failed: transform failure`,
        })
        if (kind === 'mutable') {
          expect(caught).toBe(original)
        } else {
          expect((caught as Error).cause).toBe(original)
        }
        if (kind !== 'string') {
          expect(caught).toMatchObject({
            name: 'TypeError',
            code: 'E_TRANSFORM',
          })
        }
      } finally {
        dispose()
      }
      expect(require(filename)).toBe(42)
    },
  )
})
