/* eslint-disable @typescript-eslint/no-var-requires */
import { glob, globSync } from 'glob'

import {
  copyDirectory,
  copyDirectorySync,
  copyFile,
  copyFileSync,
  copyTpl,
  copyTplSync,
  type CopyFileOptions,
} from '../../src/file/copy'

// Mock 所有依赖项
jest.mock('glob')
jest.mock('node:fs')
jest.mock('node:fs/promises')
jest.mock('../../src/file/dir')
jest.mock('../../src/file/is')
jest.mock('../../src/file/read')
jest.mock('../../src/file/render')
jest.mock('../../src/file/write')

describe('文件复制工具 - Mock 测试', () => {
  const mockGlob = glob as jest.MockedFunction<typeof glob>
  const mockGlobSync = globSync as jest.MockedFunction<typeof globSync>
  const mockFsp = require('node:fs/promises') as {
    copyFile: jest.MockedFunction<
      (src: string, dest: string, mode?: number) => Promise<void>
    >
  }
  const mockFs = require('node:fs') as {
    copyFileSync: jest.MockedFunction<
      (src: string, dest: string, mode?: number) => void
    >
  }
  const mockMkdir = require('../../src/file/dir').mkdir as jest.MockedFunction<
    (dirPath: string) => Promise<void>
  >
  const mockMkdirSync = require('../../src/file/dir')
    .mkdirSync as jest.MockedFunction<(dirPath: string) => void>
  const mockIsDirectory = require('../../src/file/is')
    .isDirectory as jest.MockedFunction<(filePath: string) => Promise<boolean>>
  const mockIsDirectorySync = require('../../src/file/is')
    .isDirectorySync as jest.MockedFunction<(filePath: string) => boolean>
  const mockReadFile = require('../../src/file/read')
    .readFile as jest.MockedFunction<(filePath: string) => Promise<string>>
  const mockReadFileSync = require('../../src/file/read')
    .readFileSync as jest.MockedFunction<(filePath: string) => string>
  const mockRenderTemplate = require('../../src/file/render')
    .renderTemplate as jest.MockedFunction<
    (
      template: string,
      data: Record<string, unknown>,
      options?: unknown,
    ) => string
  >
  const mockWriteFile = require('../../src/file/write')
    .writeFile as jest.MockedFunction<
    (filePath: string, content: string) => Promise<void>
  >
  const mockWriteFileSync = require('../../src/file/write')
    .writeFileSync as jest.MockedFunction<
    (filePath: string, content: string) => void
  >

  beforeEach(() => {
    jest.clearAllMocks()

    // 设置基本的 mock 行为
    mockMkdir.mockResolvedValue(undefined)
    mockMkdirSync.mockImplementation(() => undefined)
    mockFsp.copyFile.mockResolvedValue(undefined)
    mockFs.copyFileSync.mockImplementation(() => undefined)
    mockRenderTemplate.mockImplementation(
      (template: string, data: Record<string, unknown>) => {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
          String(data[key] || match),
        )
      },
    )
    mockReadFile.mockResolvedValue('Template {{name}} content')
    mockReadFileSync.mockReturnValue('Sync {{name}} content')
    mockWriteFile.mockResolvedValue(undefined)
    mockWriteFileSync.mockImplementation(() => undefined)

    // Mock 控制台
    jest.spyOn(console, 'log').mockImplementation()
  })

  describe('copyFile 异步文件复制', () => {
    it('应该调用正确的依赖函数', async () => {
      await copyFile('/source.txt', '/target.txt')

      expect(mockMkdir).toHaveBeenCalledWith('/')
      expect(mockFsp.copyFile).toHaveBeenCalledWith(
        '/source.txt',
        '/target.txt',
        undefined,
      )
    })

    it('应该传递复制模式', async () => {
      const options: CopyFileOptions = { mode: 123 }

      await copyFile('/source.txt', '/target.txt', options)

      expect(mockFsp.copyFile).toHaveBeenCalledWith(
        '/source.txt',
        '/target.txt',
        123,
      )
    })

    it('应该在有 basedir 时打印相对路径', async () => {
      const mockConsoleLog = jest.spyOn(console, 'log')
      const options: CopyFileOptions = { basedir: '/base' }

      await copyFile('/source.txt', '/base/sub/target.txt', options)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Copy:.*sub\/target\.txt/),
      )
    })

    it('应该渲染包含模板的目标路径', async () => {
      const data = { name: 'rendered' }

      await copyFile('/source.txt', '/{{name}}.txt', { data })

      expect(mockRenderTemplate).toHaveBeenCalledWith(
        '/{{name}}.txt',
        data,
        undefined,
      )
    })

    it('应该处理 EJS 样式的模板', async () => {
      const data = { type: 'config' }

      await copyFile('/source.txt', '/<% type %>.txt', { data })

      expect(mockRenderTemplate).toHaveBeenCalledWith(
        '/<% type %>.txt',
        data,
        undefined,
      )
    })

    it('应该在复制失败时抛出增强错误', async () => {
      mockFsp.copyFile.mockRejectedValue(new Error('ENOENT'))

      await expect(copyFile('/nonexistent.txt', '/target.txt')).rejects.toThrow(
        /Copy file .* failed.*ENOENT/,
      )
    })
  })

  describe('copyFileSync 同步文件复制', () => {
    it('应该调用同步复制函数', () => {
      copyFileSync('/sync-source.txt', '/sync-target.txt')

      expect(mockMkdirSync).toHaveBeenCalledWith('/')
      expect(mockFs.copyFileSync).toHaveBeenCalledWith(
        '/sync-source.txt',
        '/sync-target.txt',
        undefined,
      )
    })

    it('应该处理同步错误', () => {
      mockFs.copyFileSync.mockImplementation(() => {
        throw new Error('Sync copy failed')
      })

      expect(() => copyFileSync('/source.txt', '/target.txt')).toThrow(
        /Copy file .* failed.*Sync copy failed/,
      )
    })
  })

  describe('copyTpl 模板复制', () => {
    it('应该读取模板并渲染内容', async () => {
      const data = { name: 'World', project: 'Test' }

      await copyTpl('/template.tpl', '/output.txt.tpl', data)

      expect(mockReadFile).toHaveBeenCalledWith('/template.tpl')
      expect(mockRenderTemplate).toHaveBeenCalledWith(
        'Template {{name}} content',
        data,
        undefined,
      )
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/output.txt',
        'Template World content',
      )
    })

    it('应该处理目标文件名中的模板', async () => {
      const data = { filename: 'dynamic' }

      await copyTpl('/source.tpl', '/{{filename}}-result.txt.tpl', data)

      // 第一次调用：渲染内容
      expect(mockRenderTemplate).toHaveBeenNthCalledWith(
        1,
        'Template {{name}} content',
        data,
        undefined,
      )
      // 第二次调用：渲染文件名
      expect(mockRenderTemplate).toHaveBeenNthCalledWith(
        2,
        '/{{filename}}-result.txt',
        data,
        undefined,
      )
    })

    it('应该传递渲染选项', async () => {
      const renderOptions = { type: 'ejs' as const }
      const options: CopyFileOptions = { renderOptions }

      await copyTpl('/template.tpl', '/output.txt', {}, options)

      expect(mockRenderTemplate).toHaveBeenCalledWith(
        'Template {{name}} content',
        {},
        renderOptions,
      )
    })

    it('应该在有 basedir 时打印写入日志', async () => {
      const mockConsoleLog = jest.spyOn(console, 'log')
      const options: CopyFileOptions = { basedir: '/project' }

      await copyTpl('/template.tpl', '/project/output.txt', {}, options)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/Write:.*output\.txt/),
      )
    })
  })

  describe('copyTplSync 同步模板复制', () => {
    it('应该同步读取和渲染模板', () => {
      const data = { name: 'SyncTest' }

      copyTplSync('/sync-template.tpl', '/sync-output.txt.tpl', data)

      expect(mockReadFileSync).toHaveBeenCalledWith('/sync-template.tpl')
      expect(mockRenderTemplate).toHaveBeenCalledWith(
        'Sync {{name}} content',
        data,
        undefined,
      )
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/sync-output.txt',
        'Sync SyncTest content',
      )
    })
  })

  describe('copyDirectory 目录复制', () => {
    beforeEach(() => {
      mockIsDirectory.mockResolvedValue(false)
    })

    it('应该调用 glob 并处理文件列表', async () => {
      const files = ['file1.txt', 'subdir/file2.js']
      mockGlob.mockResolvedValue(files)

      await copyDirectory('/source', '/target', {})

      expect(mockGlob).toHaveBeenCalledWith('**/*', {
        cwd: '/source',
        dot: true,
        ignore: ['**/node_modules/**'],
      })
      expect(mockIsDirectory).toHaveBeenCalledTimes(2)
    })

    it('应该区分普通文件和模板文件', async () => {
      const files = ['normal.txt', 'template.tpl']
      mockGlob.mockResolvedValue(files)

      await copyDirectory('/source', '/target', { name: 'test' })

      // normal.txt 使用 copyFile，template.tpl 使用 copyTpl
      expect(mockIsDirectory).toHaveBeenCalledTimes(2)
      expect(mockReadFile).toHaveBeenCalled() // copyTpl 调用
    })

    it('应该跳过目录', async () => {
      const files = ['file.txt', 'directory']
      mockGlob.mockResolvedValue(files)
      mockIsDirectory
        .mockResolvedValueOnce(false) // file.txt
        .mockResolvedValueOnce(true) // directory

      await copyDirectory('/source', '/target', {})

      expect(mockIsDirectory).toHaveBeenCalledTimes(2)
      // 只有一个文件被处理（directory 被跳过）
    })
  })

  describe('copyDirectorySync 同步目录复制', () => {
    beforeEach(() => {
      mockIsDirectorySync.mockReturnValue(false)
    })

    it('应该调用 globSync 并处理文件', () => {
      const files = ['file1.txt', 'file2.js']
      mockGlobSync.mockReturnValue(files)

      copyDirectorySync('/sync-source', '/sync-target', {})

      expect(mockGlobSync).toHaveBeenCalledWith('**/*', {
        cwd: '/sync-source',
        dot: true,
        ignore: ['**/node_modules/**'],
      })
      expect(mockIsDirectorySync).toHaveBeenCalledTimes(2)
    })
  })

  describe('文件前缀转换测试', () => {
    it('应该正确处理各种前缀格式', async () => {
      // 测试单连字符前缀 -> 点前缀
      await copyFile('/source.txt', '/-gitignore')
      expect(mockFsp.copyFile).toHaveBeenCalledWith(
        '/source.txt',
        '/.gitignore',
        undefined,
      )

      // 测试双连字符前缀 -> 单连字符
      await copyFile('/source.txt', '/--file')
      expect(mockFsp.copyFile).toHaveBeenCalledWith(
        '/source.txt',
        '/-file',
        undefined,
      )

      // 测试嵌套路径中的前缀转换
      await copyFile('/source.txt', '/dir/-hidden')
      expect(mockFsp.copyFile).toHaveBeenCalledWith(
        '/source.txt',
        '/dir/.hidden',
        undefined,
      )

      // 测试普通文件名不变
      await copyFile('/source.txt', '/normal.txt')
      expect(mockFsp.copyFile).toHaveBeenCalledWith(
        '/source.txt',
        '/normal.txt',
        undefined,
      )
    })
  })

  describe('错误处理测试', () => {
    it('应该在 copyFile 失败时抛出错误', async () => {
      mockMkdir.mockRejectedValue(new Error('Permission denied'))

      await expect(copyFile('/source.txt', '/target.txt')).rejects.toThrow(
        /Copy file .* failed/,
      )
    })

    it('应该在 copyTpl 读取失败时抛出错误', async () => {
      mockReadFile.mockRejectedValue(new Error('Read template failed'))

      await expect(copyTpl('/template.tpl', '/output.txt', {})).rejects.toThrow(
        /Copy template .* failed/,
      )
    })

    it('应该在 copyDirectory glob 失败时抛出错误', async () => {
      mockGlob.mockRejectedValue(new Error('Glob pattern failed'))

      await expect(copyDirectory('/source', '/target', {})).rejects.toThrow(
        /Copy directory .* failed/,
      )
    })
  })

  describe('选项传递测试', () => {
    it('应该正确传递所有选项', async () => {
      const options: CopyFileOptions = {
        mode: 0o644,
        basedir: '/project',
        data: { name: 'test', version: '1.0' },
        renderOptions: { type: 'mustache' as const },
      }

      await copyFile('/source.txt', '/{{name}}-{{version}}.txt', options)

      expect(mockRenderTemplate).toHaveBeenCalledWith(
        '/{{name}}-{{version}}.txt',
        options.data,
        options.renderOptions,
      )
      expect(mockFsp.copyFile).toHaveBeenCalledWith(
        '/source.txt',
        '/test-1.0.txt',
        options.mode,
      )
    })

    it('应该处理没有数据的模板', async () => {
      await copyFile('/source.txt', '/{{undefined}}.txt', {})

      expect(mockRenderTemplate).toHaveBeenCalledWith(
        '/{{undefined}}.txt',
        {},
        undefined,
      )
    })
  })

  describe('复杂场景测试', () => {
    it('应该处理模板文件的复杂渲染', async () => {
      const templateContent =
        'Project: {{project}}\nAuthor: {{author}}\nVersion: {{version}}'
      mockReadFile.mockResolvedValue(templateContent)

      const data = {
        project: 'MyApp',
        author: 'Developer',
        version: '2.0.0',
      }

      await copyTpl('/complex.tpl', '/{{project}}-v{{version}}.txt.tpl', data)

      expect(mockReadFile).toHaveBeenCalledWith('/complex.tpl')
      expect(mockRenderTemplate).toHaveBeenNthCalledWith(
        1,
        templateContent,
        data,
        undefined,
      )
      expect(mockRenderTemplate).toHaveBeenNthCalledWith(
        2,
        '/{{project}}-v{{version}}.txt',
        data,
        undefined,
      )
    })

    it('应该在目录复制中正确区分文件类型', async () => {
      const files = [
        'README.md',
        'config.json.tpl',
        'src/index.ts',
        'templates/base.tpl',
      ]
      mockGlob.mockResolvedValue(files)
      mockIsDirectory.mockResolvedValue(false)

      await copyDirectory('/project-template', '/new-project', {
        projectName: 'MyProject',
      })

      expect(mockGlob).toHaveBeenCalledWith('**/*', {
        cwd: '/project-template',
        dot: true,
        ignore: ['**/node_modules/**'],
      })

      // 应该检查每个文件是否为目录
      expect(mockIsDirectory).toHaveBeenCalledTimes(4)

      // 模板文件应该调用 readFile（copyTpl 使用）
      expect(mockReadFile).toHaveBeenCalled()
    })
  })
})
