/* eslint-disable @typescript-eslint/no-var-requires */
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
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
jest.mock('rimraf')
jest.mock('../../src/file/is')
jest.mock('ejs')
jest.mock('mustache')

describe('文件移动、删除和渲染工具', () => {
  const mockRimraf = rimraf as jest.MockedFunction<typeof rimraf>
  const mockRimrafSync = rimrafSync as jest.MockedFunction<typeof rimrafSync>
  const mockIsPathExists = require('../../src/file/is')
    .isPathExists as jest.MockedFunction<(filePath: string) => Promise<boolean>>
  const mockIsPathExistsSync = require('../../src/file/is')
    .isPathExistsSync as jest.MockedFunction<(filePath: string) => boolean>
  const mockEjs = require('ejs') as {
    render: jest.MockedFunction<
      (
        template: string,
        data: Record<string, unknown>,
        options?: unknown,
      ) => string
    >
  }
  const mockMustache = require('mustache') as {
    render: jest.MockedFunction<
      (
        template: string,
        data: Record<string, unknown>,
        partials?: unknown,
        tags?: unknown,
      ) => string
    >
  }

  let tempDir: string
  let sourceFile: string
  let targetFile: string

  beforeEach(async () => {
    jest.clearAllMocks()

    // 创建临时目录
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'move-test-'))
    sourceFile = path.join(tempDir, 'source.txt')
    targetFile = path.join(tempDir, 'target.txt')

    // 创建源文件
    await fsp.writeFile(sourceFile, 'test content')
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    try {
      await fsp.rm(tempDir, { recursive: true, force: true })
    } catch {
      // 忽略清理错误
    }
  })

  describe('move 异步文件移动', () => {
    it('应该移动文件到新位置', async () => {
      mockIsPathExists.mockResolvedValue(false)

      await move(sourceFile, targetFile)

      expect(mockIsPathExists).toHaveBeenCalledWith(targetFile)
      expect(fs.existsSync(sourceFile)).toBe(false)
      expect(fs.existsSync(targetFile)).toBe(true)
    })

    it('应该在目标存在且不覆盖时抛出错误', async () => {
      mockIsPathExists.mockResolvedValue(true)

      await expect(move(sourceFile, targetFile)).rejects.toThrow(
        /already exists/,
      )
    })

    it('应该在覆盖模式下删除目标文件', async () => {
      mockIsPathExists.mockResolvedValue(true)
      mockRimraf.mockResolvedValue(true)

      await move(sourceFile, targetFile, true)

      expect(mockRimraf).toHaveBeenCalledWith(targetFile)
    })

    it('应该在移动失败时抛出错误', async () => {
      mockIsPathExists.mockResolvedValue(false)

      const invalidTarget = '/invalid/readonly/target.txt'

      await expect(move(sourceFile, invalidTarget)).rejects.toThrow()
    })
  })

  describe('moveSync 同步文件移动', () => {
    it('应该同步移动文件', () => {
      mockIsPathExistsSync.mockReturnValue(false)

      moveSync(sourceFile, targetFile)

      expect(mockIsPathExistsSync).toHaveBeenCalledWith(targetFile)
      expect(fs.existsSync(sourceFile)).toBe(false)
      expect(fs.existsSync(targetFile)).toBe(true)
    })

    it('应该在同步模式下处理覆盖', () => {
      mockIsPathExistsSync.mockReturnValue(true)
      mockRimrafSync.mockReturnValue(true)

      moveSync(sourceFile, targetFile, true)

      expect(mockRimrafSync).toHaveBeenCalledWith(targetFile)
    })

    it('应该在目标存在且不覆盖时抛出错误', () => {
      mockIsPathExistsSync.mockReturnValue(true)

      expect(() => moveSync(sourceFile, targetFile)).toThrow(/already exists/)
    })
  })

  describe('remove 异步删除', () => {
    it('应该删除文件', async () => {
      mockRimraf.mockResolvedValue(true)

      const result = await remove(sourceFile)

      expect(mockRimraf).toHaveBeenCalledWith(sourceFile)
      expect(result).toBe(true)
    })

    it('应该删除目录', async () => {
      const testDir = path.join(tempDir, 'test-dir')
      await fsp.mkdir(testDir)
      mockRimraf.mockResolvedValue(true)

      const result = await remove(testDir)

      expect(mockRimraf).toHaveBeenCalledWith(testDir)
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

      expect(mockRimrafSync).toHaveBeenCalledWith(sourceFile)
      expect(result).toBe(true)
    })

    it('应该同步删除目录', () => {
      mockRimrafSync.mockReturnValue(true)

      const result = removeSync(tempDir)

      expect(mockRimrafSync).toHaveBeenCalledWith(tempDir)
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

        expect(() => renderTemplate(template, data)).toThrow(/Render .* failed/)
      })

      it('应该在 EJS 渲染失败时抛出错误', () => {
        mockEjs.render.mockImplementation(() => {
          throw new Error('EJS render error')
        })

        const template = 'Invalid <%= template'
        const data = { test: 'data' }
        const options: EjsRenderTemplateOptions = { type: 'ejs' }

        expect(() => renderTemplate(template, data, options)).toThrow(
          /Render .* failed/,
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
