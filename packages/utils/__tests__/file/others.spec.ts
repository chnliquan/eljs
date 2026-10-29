import ejs from 'ejs'
import Mustache from 'mustache'
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest'

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { rimraf, rimrafSync } from 'rimraf'

import {
  move,
  moveSync,
  remove,
  removeSync,
  renderTemplate,
  type EjsRenderTemplateOptions,
  type MustacheRenderTemplateOptions,
} from '../../src/file'

// Mock 依赖项
vi.mock('rimraf')
vi.mock('ejs')
vi.mock('mustache')

describe('文件移动、删除和渲染工具', () => {
  const mockRimraf = rimraf as MockedFunction<typeof rimraf>
  const mockRimrafSync = rimrafSync as MockedFunction<typeof rimrafSync>
  const mockEjs = vi.mocked(ejs, { deep: true })
  const mockMustache = vi.mocked(Mustache, { deep: true })

  let tempDir: string
  let sourceFile: string
  let targetFile: string

  beforeEach(async () => {
    vi.clearAllMocks()

    // 创建临时目录
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'move-test-'))
    sourceFile = path.join(tempDir, 'source.txt')
    targetFile = path.join(tempDir, 'target.txt')

    // 创建源文件
    await fsp.writeFile(sourceFile, 'test content')
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    try {
      await fsp.rm(tempDir, { recursive: true, force: true })
    } catch {
      // 忽略清理错误
    }
  })

  describe('move 异步文件移动', () => {
    it('应该移动文件到新位置', async () => {
      await move(sourceFile, targetFile)

      expect(fs.existsSync(sourceFile)).toBe(false)
      expect(fs.existsSync(targetFile)).toBe(true)
    })

    it('应该在目标存在且不覆盖时抛出错误', async () => {
      await fsp.writeFile(targetFile, 'original')

      await expect(move(sourceFile, targetFile)).rejects.toThrow(
        /already exists/,
      )
    })

    it('应该通过重命名覆盖目标文件', async () => {
      await fsp.writeFile(targetFile, 'original')

      await move(sourceFile, targetFile, true)

      expect(fs.readFileSync(targetFile, 'utf8')).toBe('test content')
      expect(mockRimraf).not.toHaveBeenCalled()
    })

    it('应该在移动失败时抛出错误', async () => {
      const invalidTarget = '/invalid/readonly/target.txt'

      await expect(move(sourceFile, invalidTarget)).rejects.toThrow()
    })
  })

  describe('moveSync 同步文件移动', () => {
    it('应该同步移动文件', () => {
      moveSync(sourceFile, targetFile)

      expect(fs.existsSync(sourceFile)).toBe(false)
      expect(fs.existsSync(targetFile)).toBe(true)
    })

    it('应该在同步模式下处理覆盖', () => {
      fs.writeFileSync(targetFile, 'original')

      moveSync(sourceFile, targetFile, true)

      expect(fs.readFileSync(targetFile, 'utf8')).toBe('test content')
      expect(mockRimrafSync).not.toHaveBeenCalled()
    })

    it('应该在目标存在且不覆盖时抛出错误', () => {
      fs.writeFileSync(targetFile, 'original')

      expect(() => moveSync(sourceFile, targetFile)).toThrow(/already exists/)
    })
  })

  describe.each([
    ['async', move],
    ['sync', moveSync],
  ] as const)('移动安全语义：%s', (kind, moveFile) => {
    const run = (from: string, to: string, overwrite = true) =>
      Promise.resolve().then(() => moveFile(from, to, overwrite))

    function createDirectories(): string {
      const source = path.join(tempDir, 'source-dir')
      fs.mkdirSync(source)
      fs.mkdirSync(targetFile)
      fs.writeFileSync(path.join(source, 'source'), 'new')
      fs.writeFileSync(path.join(targetFile, 'target'), 'keep')
      return source
    }

    function failRenameCalls(calls: number[], error: Error): void {
      const rename = fs.renameSync
      let count = 0
      const injectedRename: typeof fs.renameSync = (from, to) => {
        count += 1
        if (calls.includes(count)) {
          throw error
        }
        rename(from, to)
      }
      if (kind === 'async') {
        vi.spyOn(fsp, 'rename').mockImplementation(async (from, to) => {
          injectedRename(from, to)
        })
      } else {
        vi.spyOn(fs, 'renameSync').mockImplementation(injectedRename)
      }
    }

    it('源不存在时保留目标及 ENOENT', async () => {
      fs.writeFileSync(targetFile, 'original')
      await expect(
        run(path.join(tempDir, 'missing'), targetFile),
      ).rejects.toMatchObject({
        code: 'ENOENT',
      })
      expect(fs.readFileSync(targetFile, 'utf8')).toBe('original')
    })

    it('拒绝相同路径和解析后相同的路径', async () => {
      for (const destination of [
        sourceFile,
        `${tempDir}/unused/../source.txt`,
      ]) {
        await expect(run(sourceFile, destination)).rejects.toThrow(
          /same or overlap/,
        )
        expect(fs.readFileSync(sourceFile, 'utf8')).toBe('test content')
      }
    })

    it('拒绝硬链接别名且保留两个目录项', async () => {
      fs.linkSync(sourceFile, targetFile)
      await expect(run(sourceFile, targetFile)).rejects.toThrow(/same file/)
      expect(fs.readFileSync(sourceFile, 'utf8')).toBe('test content')
      expect(fs.readFileSync(targetFile, 'utf8')).toBe('test content')
    })

    it('拒绝目录的双向包含关系', async () => {
      const parent = path.join(tempDir, 'parent')
      const child = path.join(parent, 'child')
      fs.mkdirSync(child, { recursive: true })
      fs.writeFileSync(path.join(child, 'keep'), 'original')
      for (const [from, to] of [
        [parent, child],
        [child, parent],
        [parent, path.join(child, 'missing')],
      ] as const) {
        await expect(run(from, to)).rejects.toThrow(/overlap/)
        expect(fs.readFileSync(path.join(child, 'keep'), 'utf8')).toBe(
          'original',
        )
      }
    })

    it.skipIf(process.platform === 'win32')(
      '拒绝父目录别名和真实路径的包含关系',
      async () => {
        const alias = path.join(tempDir, 'alias')
        fs.symlinkSync(tempDir, alias)
        await expect(
          run(sourceFile, path.join(alias, 'source.txt')),
        ).rejects.toThrow(/same or overlap/)
        const source = path.join(tempDir, 'source-dir')
        const nested = path.join(source, 'nested')
        fs.mkdirSync(nested, { recursive: true })
        fs.writeFileSync(path.join(nested, 'keep'), 'original')
        const nestedAlias = path.join(tempDir, 'nested-alias')
        fs.symlinkSync(nested, nestedAlias)
        await expect(
          run(source, path.join(nestedAlias, 'target')),
        ).rejects.toThrow(/overlap/)
        await expect(
          run(source, path.join(nestedAlias, 'missing', 'target')),
        ).rejects.toMatchObject({ code: 'ENOENT' })
        expect(fs.readFileSync(sourceFile, 'utf8')).toBe('test content')
        expect(fs.readFileSync(path.join(nested, 'keep'), 'utf8')).toBe(
          'original',
        )
        expect(fs.lstatSync(nestedAlias).isSymbolicLink()).toBe(true)
      },
    )

    it.skipIf(process.platform === 'win32')(
      '移动符号链接本身，不遍历其循环目标',
      async () => {
        const link = path.join(tempDir, 'loop')
        fs.symlinkSync('loop', link)
        await run(link, targetFile)
        expect(fs.lstatSync(targetFile).isSymbolicLink()).toBe(true)
        expect(fs.readlinkSync(targetFile)).toBe('loop')
        expect(fs.existsSync(link)).toBe(false)
      },
    )

    it.skipIf(process.platform === 'win32')(
      '允许用源文件替换指向源文件的符号链接',
      async () => {
        fs.symlinkSync(sourceFile, targetFile)
        await run(sourceFile, targetFile)
        expect(fs.lstatSync(targetFile).isSymbolicLink()).toBe(false)
        expect(fs.readFileSync(targetFile, 'utf8')).toBe('test content')
        expect(fs.existsSync(sourceFile)).toBe(false)
      },
    )

    it.skipIf(process.platform === 'win32')(
      '禁止覆盖时将悬空链接视为存在，覆盖时只替换链接',
      async () => {
        const missing = path.join(tempDir, 'missing')
        fs.symlinkSync(missing, targetFile)
        await expect(run(sourceFile, targetFile, false)).rejects.toThrow(
          /already exists/,
        )
        expect(fs.lstatSync(targetFile).isSymbolicLink()).toBe(true)
        expect(fs.readFileSync(sourceFile, 'utf8')).toBe('test content')
        await run(sourceFile, targetFile)
        expect(fs.readFileSync(targetFile, 'utf8')).toBe('test content')
        expect(fs.existsSync(missing)).toBe(false)
      },
    )

    it.skipIf(process.platform === 'win32')(
      '覆盖符号链接不修改链接指向的文件',
      async () => {
        const referent = path.join(tempDir, 'referent')
        fs.writeFileSync(referent, 'keep')
        fs.symlinkSync(referent, targetFile)
        await run(sourceFile, targetFile)
        expect(fs.lstatSync(targetFile).isSymbolicLink()).toBe(false)
        expect(fs.readFileSync(targetFile, 'utf8')).toBe('test content')
        expect(fs.readFileSync(referent, 'utf8')).toBe('keep')
      },
    )

    it('非空目录替换成功后清理备份，保留原有覆盖兼容性', async () => {
      const source = createDirectories()
      await run(source, targetFile)
      expect(fs.existsSync(source)).toBe(false)
      expect(fs.readdirSync(targetFile)).toEqual(['source'])
      expect(fs.readFileSync(path.join(targetFile, 'source'), 'utf8')).toBe(
        'new',
      )
      expect(fs.readdirSync(tempDir).sort()).toEqual([
        'source.txt',
        'target.txt',
      ])
    })

    it.each([2, 3])('第 %s 次重命名失败时保留源并恢复旧目标', async call => {
      const source = createDirectories()
      const error = Object.assign(new Error('rename denied'), {
        code: 'EACCES',
      })
      failRenameCalls([call], error)
      await expect(run(source, targetFile)).rejects.toBe(error)
      expect(fs.readFileSync(path.join(source, 'source'), 'utf8')).toBe('new')
      expect(fs.readFileSync(path.join(targetFile, 'target'), 'utf8')).toBe(
        'keep',
      )
      expect(fs.readdirSync(tempDir).sort()).toEqual([
        'source-dir',
        'source.txt',
        'target.txt',
      ])
    })

    it('恢复失败时报告并保留旧目标备份，不删除源文件', async () => {
      const source = createDirectories()
      const reason = new Error('rename denied')
      failRenameCalls([3, 4], reason)
      const error = await run(source, targetFile).catch(value => value)
      expect(error).toBeInstanceOf(AggregateError)
      expect(error.errors).toEqual([reason, reason])
      const backupDirectory = fs
        .readdirSync(tempDir)
        .find(name => name.startsWith('.eljs-move-'))
      assert(backupDirectory, 'Backup directory should be preserved')
      const backup = path.join(tempDir, backupDirectory, 'destination')
      expect(error.message).toContain(backup)
      expect(fs.readFileSync(path.join(backup, 'target'), 'utf8')).toBe('keep')
      expect(fs.readFileSync(path.join(source, 'source'), 'utf8')).toBe('new')
    })

    it('EXDEV 直接抛出且不暂存或删除目标', async () => {
      const source = createDirectories()
      const error = Object.assign(new Error('cross-device move'), {
        code: 'EXDEV',
      })
      failRenameCalls([1], error)
      await expect(run(source, targetFile)).rejects.toBe(error)
      expect(fs.readFileSync(path.join(source, 'source'), 'utf8')).toBe('new')
      expect(fs.readFileSync(path.join(targetFile, 'target'), 'utf8')).toBe(
        'keep',
      )
      expect(fs.readdirSync(tempDir).sort()).toEqual([
        'source-dir',
        'source.txt',
        'target.txt',
      ])
    })

    it('文件覆盖目录失败时保留源及目标', async () => {
      fs.mkdirSync(targetFile)
      fs.writeFileSync(path.join(targetFile, 'keep'), 'original')
      await expect(run(sourceFile, targetFile)).rejects.toThrow()
      expect(fs.readFileSync(sourceFile, 'utf8')).toBe('test content')
      expect(fs.readFileSync(path.join(targetFile, 'keep'), 'utf8')).toBe(
        'original',
      )
    })
  })

  describe('remove 异步删除', () => {
    it('应该删除文件', async () => {
      mockRimraf.mockResolvedValue(true)

      const result = await remove(sourceFile)

      expect(mockRimraf).toHaveBeenCalledWith(sourceFile, undefined)
      expect(result).toBe(true)
    })

    it('应该删除目录', async () => {
      const testDir = path.join(tempDir, 'test-dir')
      await fsp.mkdir(testDir)
      mockRimraf.mockResolvedValue(true)

      const result = await remove(testDir)

      expect(mockRimraf).toHaveBeenCalledWith(testDir, undefined)
      expect(result).toBe(true)
    })

    it('应该处理不存在的路径', async () => {
      mockRimraf.mockResolvedValue(false)

      const result = await remove('/nonexistent/path')

      expect(result).toBe(false)
    })
  })

  describe('removeSync 同步删除', () => {
    it('应该同步删除文件', () => {
      mockRimrafSync.mockReturnValue(true)

      const result = removeSync(sourceFile)

      expect(mockRimrafSync).toHaveBeenCalledWith(sourceFile, undefined)
      expect(result).toBe(true)
    })

    it('应该同步删除目录', () => {
      mockRimrafSync.mockReturnValue(true)

      const result = removeSync(tempDir)

      expect(mockRimrafSync).toHaveBeenCalledWith(tempDir, undefined)
      expect(result).toBe(true)
    })
  })

  describe('renderTemplate 模板渲染', () => {
    describe('Mustache 模板渲染', () => {
      beforeEach(() => {
        mockMustache.render.mockReturnValue('Rendered content')
      })

      it('应该使用 Mustache 渲染模板', () => {
        const template = 'Hello {{name}}!'
        const data = { name: 'World' }

        const result = renderTemplate(template, data)

        expect(mockMustache.render).toHaveBeenCalledWith(
          template,
          data,
          undefined,
          undefined,
        )
        expect(result).toBe('Rendered content')
      })

      it('应该使用 Mustache 选项渲染模板', () => {
        const template = 'Hello {{name}}!'
        const data = { name: 'World' }
        const options: MustacheRenderTemplateOptions = {
          type: 'mustache',
          partials: { header: 'Header template' },
          tagsOrOptions: ['<%', '%>'],
        }

        renderTemplate(template, data, options)

        expect(mockMustache.render).toHaveBeenCalledWith(
          template,
          data,
          { header: 'Header template' },
          ['<%', '%>'],
        )
      })

      it('应该默认使用 Mustache 引擎', () => {
        const template = 'Default {{engine}}'
        const data = { engine: 'mustache' }

        renderTemplate(template, data)

        expect(mockMustache.render).toHaveBeenCalledWith(
          template,
          data,
          undefined,
          undefined,
        )
      })
    })

    describe('EJS 模板渲染', () => {
      beforeEach(() => {
        mockEjs.render.mockReturnValue('EJS rendered content')
      })

      it('应该使用 EJS 渲染模板', () => {
        const template = 'Hello <%= name %>!'
        const data = { name: 'EJS World' }
        const options: EjsRenderTemplateOptions = {
          type: 'ejs',
          options: { delimiter: '%' },
        }

        const result = renderTemplate(template, data, options)

        expect(mockEjs.render).toHaveBeenCalledWith(template, data, {
          delimiter: '%',
          async: false,
        })
        expect(result).toBe('EJS rendered content')
      })

      it('应该在没有 EJS 选项时使用默认配置', () => {
        const template = 'Hello <%= name %>!'
        const data = { name: 'Default EJS' }
        const options: EjsRenderTemplateOptions = { type: 'ejs' }

        renderTemplate(template, data, options)

        expect(mockEjs.render).toHaveBeenCalledWith(template, data, {
          async: false,
        })
      })
    })

    describe('错误处理', () => {
      it('应该在 Mustache 渲染失败时抛出错误', () => {
        mockMustache.render.mockImplementation(() => {
          throw new Error('Mustache render error')
        })

        const template = 'Invalid {{template'
        const data = { test: 'data' }

        expect(() => renderTemplate(template, data)).toThrow(
          'Render Mustache template failed',
        )
        expect(() => renderTemplate(template, data)).not.toThrow(template)
        expect(() => renderTemplate(template, data)).not.toThrow(
          'Mustache render error',
        )
      })

      it('应该在 EJS 渲染失败时抛出错误', () => {
        mockEjs.render.mockImplementation(() => {
          throw new Error('EJS render error')
        })

        const template = 'Invalid <%= template'
        const data = { test: 'data' }
        const options: EjsRenderTemplateOptions = { type: 'ejs' }

        expect(() => renderTemplate(template, data, options)).toThrow(
          'Render EJS template failed',
        )
        expect(() => renderTemplate(template, data, options)).not.toThrow(
          'EJS render error',
        )
      })
    })

    describe('模板数据类型安全', () => {
      beforeEach(() => {
        // 重置 mock 为成功状态，防止之前的错误测试影响
        mockMustache.render.mockReturnValue('Rendered successfully')
      })

      it('应该处理复杂的数据结构', () => {
        interface TemplateData {
          user: {
            name: string
            email: string
          }
          settings: {
            theme: string
            notifications: boolean
          }
          items: string[]
        }

        const data: TemplateData = {
          user: {
            name: 'John Doe',
            email: 'john@example.com',
          },
          settings: {
            theme: 'dark',
            notifications: true,
          },
          items: ['item1', 'item2', 'item3'],
        }

        const template = 'User: {{user.name}}'

        renderTemplate(template, data)

        expect(mockMustache.render).toHaveBeenCalledWith(
          template,
          data,
          undefined,
          undefined,
        )
      })

      it('应该处理空数据对象', () => {
        const template = 'No data template'
        const data: Record<string, never> = {}

        renderTemplate(template, data)

        expect(mockMustache.render).toHaveBeenCalledWith(
          template,
          data,
          undefined,
          undefined,
        )
      })
    })
  })
})
