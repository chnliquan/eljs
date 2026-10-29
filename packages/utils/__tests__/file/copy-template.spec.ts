import { afterEach, beforeEach, expect, expectTypeOf, it } from 'vitest'

import {
  constants,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  copyDirectory,
  copyDirectorySync,
  copyFile,
  copyFileSync,
  copyTemplate,
  copyTemplateSync,
  type CopyFileOptions,
  type CopyFileSyncOptions,
} from '../../src/file/copy'
import type { RenderTemplateOptions } from '../../src/file/render'
import type { WriteFileSyncOptions } from '../../src/file/write'

let directory: string
let template: string
let target: string

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'copy-template-options-'))
  const source = path.join(directory, 'templates')
  mkdirSync(source)
  template = path.join(source, 'source.tpl')
  target = path.join(directory, 'output.txt')
  writeFileSync(template, '你好 {{name}}')
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

it('模板写入选项支持指定编码并追加内容', async () => {
  const encoding = 'utf16le'
  const overwriteOptions = {
    writeOptions: { encoding },
  } as const
  const appendOptions = {
    writeOptions: { encoding, flag: 'a' },
  } as const
  await copyTemplate(template, target, { name: '世界' }, overwriteOptions)
  copyTemplateSync(template, target, { name: '朋友' }, appendOptions)

  expect(readFileSync(target, 'utf16le')).toBe('你好 世界你好 朋友')
})

it('同步和异步模板写入均支持独占创建', async () => {
  const options = { writeOptions: Object.freeze({ flag: 'wx' }) }
  await copyTemplate(template, target, { name: '原始内容' }, options)

  await expect(
    copyTemplate(template, target, { name: '覆盖' }, options),
  ).rejects.toMatchObject({ code: 'EEXIST' })
  expect(() =>
    copyTemplateSync(template, target, { name: '覆盖' }, options),
  ).toThrow(expect.objectContaining({ code: 'EEXIST' }))
  expect(readFileSync(target, 'utf8')).toBe('你好 原始内容')
})

it.skipIf(process.platform === 'win32')(
  '写入权限与普通文件复制标志独立',
  async () => {
    const options = {
      mode: constants.COPYFILE_EXCL,
      writeOptions: { mode: 0o600 },
    }
    await copyTemplate(template, target, { name: '世界' }, options)

    expect(statSync(target).mode & 0o777).toBe(0o600 & ~process.umask())
    await expect(
      copyFile(template, target, { mode: constants.COPYFILE_EXCL }),
    ).rejects.toMatchObject({ code: 'EEXIST' })
  },
)

it.each(['async', 'sync'] as const)(
  '目录复制向模板透传写入选项：%s',
  async kind => {
    const source = path.dirname(template)
    const output = path.join(directory, 'generated')
    const options = { writeOptions: { flag: 'wx' } }

    if (kind === 'async') {
      await copyDirectory(source, output, { name: '目录' }, options)
      await expect(
        copyDirectory(source, output, { name: '覆盖' }, options),
      ).rejects.toMatchObject({ code: 'EEXIST' })
    } else {
      copyDirectorySync(source, output, { name: '目录' }, options)
      expect(() =>
        copyDirectorySync(source, output, { name: '覆盖' }, options),
      ).toThrow(expect.objectContaining({ code: 'EEXIST' }))
    }

    expect(readFileSync(path.join(output, 'source'), 'utf8')).toBe('你好 目录')
  },
)

it('同步复制类型使用同步写入选项，异步仍接受取消信号', () => {
  expectTypeOf<CopyFileSyncOptions['writeOptions']>().toEqualTypeOf<
    WriteFileSyncOptions | undefined
  >()
  expectTypeOf(copyFileSync)
    .parameter(2)
    .toEqualTypeOf<CopyFileSyncOptions | undefined>()
  expectTypeOf(copyTemplateSync)
    .parameter(3)
    .toEqualTypeOf<CopyFileSyncOptions | undefined>()
  expectTypeOf(copyDirectorySync)
    .parameter(3)
    .toEqualTypeOf<CopyFileSyncOptions | undefined>()
  const options = { writeOptions: { signal: new AbortController().signal } }
  expectTypeOf(options).toExtend<CopyFileOptions>()
  // @ts-expect-error 同步复制不接受含取消信号的选项变量
  const invalid: CopyFileSyncOptions = options
  const output = path.join(directory, 'new-parent', 'output')
  const copies = [
    () => copyFileSync(template, output, invalid),
    () => copyTemplateSync(template, output, {}, invalid),
    () => copyDirectorySync(path.dirname(template), output, {}, invalid),
  ]
  writeFileSync(target, 'keep')
  for (const copy of copies) {
    expect(copy).toThrow(/do not support signal/)
    expect(existsSync(path.dirname(output))).toBe(false)
    expect(readFileSync(target, 'utf8')).toBe('keep')
  }
  expect(() => copyTemplateSync(template, target, {}, invalid)).toThrow(
    /do not support signal/,
  )
  expect(readFileSync(target, 'utf8')).toBe('keep')
})

it.each(['async', 'sync'] as const)(
  '无效源目录在枚举前失败且不修改目标：%s',
  async kind => {
    writeFileSync(target, 'keep')
    const output = path.join(directory, 'new-output')
    const copy = (source: string, destination: string) =>
      Promise.resolve().then(() =>
        kind === 'async'
          ? copyDirectory(source, destination, {})
          : copyDirectorySync(source, destination, {}),
      )
    const sources = [
      [path.join(directory, 'missing'), 'ENOENT'],
      [template, 'ENOTDIR'],
      [path.join(template, 'child'), 'ENOTDIR'],
    ] as const
    for (const [source, code] of sources) {
      for (const destination of [output, target]) {
        await expect(copy(source, destination)).rejects.toMatchObject({
          code,
          message: expect.stringContaining(`Copy directory from ${source}`),
        })
      }
    }
    expect(existsSync(output)).toBe(false)
    expect(readFileSync(target, 'utf8')).toBe('keep')
  },
)

it.skipIf(process.platform === 'win32')(
  '目录校验跟随符号链接，拒绝悬空链接并复制有效链接',
  async () => {
    const source = path.join(directory, 'source-link')
    symlinkSync(path.dirname(template), source)
    await copyDirectory(source, path.join(directory, 'async'), { name: '链接' })
    copyDirectorySync(source, path.join(directory, 'sync'), { name: '链接' })
    expect(readFileSync(path.join(directory, 'async', 'source'), 'utf8')).toBe(
      '你好 链接',
    )
    expect(readFileSync(path.join(directory, 'sync', 'source'), 'utf8')).toBe(
      '你好 链接',
    )
    const dangling = path.join(directory, 'dangling')
    symlinkSync(path.join(directory, 'missing'), dangling)
    await expect(copyDirectory(dangling, target, {})).rejects.toMatchObject({
      code: 'ENOENT',
    })
    expect(() => copyDirectorySync(dangling, target, {})).toThrow(
      expect.objectContaining({ code: 'ENOENT' }),
    )
    expect(existsSync(target)).toBe(false)
  },
)

const pathTemplates: Array<{
  name: string
  filename: string
  renderOptions: RenderTemplateOptions
}> = [
  { name: 'Mustache 默认', filename: '{{name}}', renderOptions: {} },
  {
    name: 'Mustache tags',
    filename: '[[name]]',
    renderOptions: { tagsOrOptions: ['[[', ']]'] },
  },
  {
    name: 'Mustache options',
    filename: '[[name]]',
    renderOptions: { tagsOrOptions: { tags: ['[[', ']]'] } },
  },
  { name: 'EJS 默认', filename: '<%= name %>', renderOptions: { type: 'ejs' } },
  {
    name: 'EJS delimiter',
    filename: '<$= name $>',
    renderOptions: { type: 'ejs', options: { delimiter: '$' } },
  },
  {
    name: 'EJS open/close',
    filename: '[%= name %]',
    renderOptions: {
      type: 'ejs',
      options: { openDelimiter: '[', closeDelimiter: ']' },
    },
  },
  {
    name: 'EJS 全部定界符',
    filename: '[$= name $]',
    renderOptions: {
      type: 'ejs',
      options: { openDelimiter: '[', delimiter: '$', closeDelimiter: ']' },
    },
  },
]

it.each(pathTemplates)(
  '四种文件/模板复制入口渲染路径：$name',
  async ({ filename, renderOptions }) => {
    writeFileSync(template, `Hello ${filename}`)
    const data = { name: 'rendered' }
    const options = { data, renderOptions }
    await copyFile(
      template,
      path.join(directory, `${filename}-async.txt`),
      options,
    )
    copyFileSync(
      template,
      path.join(directory, `${filename}-sync.txt`),
      options,
    )
    await copyTemplate(
      template,
      path.join(directory, `${filename}-async.tpl`),
      data,
      options,
    )
    copyTemplateSync(
      template,
      path.join(directory, `${filename}-sync.tpl`),
      data,
      options,
    )
    for (const suffix of ['async', 'sync']) {
      expect(
        readFileSync(path.join(directory, `rendered-${suffix}.txt`), 'utf8'),
      ).toBe(`Hello ${filename}`)
      expect(
        readFileSync(path.join(directory, `rendered-${suffix}`), 'utf8'),
      ).toBe('Hello rendered')
    }
  },
)

it.each(['async', 'sync'] as const)(
  '目录复制向普通文件和模板路径透传定界符：%s',
  async kind => {
    const source = path.join(directory, 'custom-source')
    mkdirSync(source)
    writeFileSync(path.join(source, '[[name]].txt'), 'plain')
    writeFileSync(path.join(source, '[[name]].tpl'), 'Hello [[name]]')
    const output = path.join(directory, 'custom-output')
    const options: CopyFileSyncOptions = {
      renderOptions: { tagsOrOptions: ['[[', ']]'] },
    }
    if (kind === 'async') {
      await copyDirectory(source, output, { name: 'rendered' }, options)
    } else {
      copyDirectorySync(source, output, { name: 'rendered' }, options)
    }
    expect(readdirSync(output).sort()).toEqual(['rendered', 'rendered.txt'])
    expect(readFileSync(path.join(output, 'rendered'), 'utf8')).toBe(
      'Hello rendered',
    )
  },
)

it('普通文件名和非当前引擎定界符保持原样', async () => {
  const renderOptions = {
    type: 'ejs',
    options: { rmWhitespace: true, delimiter: '$' },
  } as const
  for (const name of ['  spaced  ', '{{name}}', '<%= name %>']) {
    await copyFile(template, path.join(directory, `${name}-async.txt`), {
      renderOptions,
    })
    copyFileSync(template, path.join(directory, `${name}-sync.txt`), {
      renderOptions,
    })
    await copyTemplate(
      template,
      path.join(directory, `${name}-async.tpl`),
      {},
      { renderOptions },
    )
    copyTemplateSync(
      template,
      path.join(directory, `${name}-sync.tpl`),
      {},
      { renderOptions },
    )
    for (const suffix of ['async', 'sync']) {
      expect(existsSync(path.join(directory, `${name}-${suffix}.txt`))).toBe(
        true,
      )
      expect(existsSync(path.join(directory, `${name}-${suffix}`))).toBe(true)
    }
  }
})
