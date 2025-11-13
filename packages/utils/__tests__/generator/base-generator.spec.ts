/* eslint-disable @typescript-eslint/no-var-requires */
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import prompts, { type PromptObject } from 'prompts'

import type { CopyFileOptions, RenderTemplateOptions } from '../../src/file'
import { BaseGenerator } from '../../src/generator'

// Mock 依赖项
jest.mock('prompts')
jest.mock('../../src/cli')
jest.mock('../../src/file')
jest.mock('../../src/logger')
jest.mock('../../src/type')
jest.mock('node:fs')

describe('BaseGenerator 基础生成器', () => {
  const mockPrompts = prompts as jest.MockedFunction<typeof prompts>
  const mockConfirm = require('../../src/cli').confirm as jest.MockedFunction<
    (message: string, preferNo?: boolean) => Promise<boolean>
  >
  const mockCopyFile = require('../../src/file')
    .copyFile as jest.MockedFunction<
    (from: string, to: string, options?: CopyFileOptions) => Promise<void>
  >
  const mockCopyFileSync = require('../../src/file')
    .copyFileSync as jest.MockedFunction<
    (from: string, to: string, options?: CopyFileOptions) => void
  >
  const mockCopyTpl = require('../../src/file').copyTpl as jest.MockedFunction<
    (
      from: string,
      to: string,
      data: Record<string, unknown>,
      options?: CopyFileOptions,
    ) => Promise<void>
  >
  const mockCopyTplSync = require('../../src/file')
    .copyTplSync as jest.MockedFunction<
    (
      from: string,
      to: string,
      data: Record<string, unknown>,
      options?: CopyFileOptions,
    ) => void
  >
  const mockCopyDirectory = require('../../src/file')
    .copyDirectory as jest.MockedFunction<
    (
      from: string,
      to: string,
      data: Record<string, unknown>,
      options?: CopyFileOptions,
    ) => Promise<void>
  >
  const mockCopyDirectorySync = require('../../src/file')
    .copyDirectorySync as jest.MockedFunction<
    (
      from: string,
      to: string,
      data: Record<string, unknown>,
      options?: CopyFileOptions,
    ) => void
  >
  const mockLogger = require('../../src/logger').logger as {
    warn: jest.MockedFunction<(message: string) => void>
  }
  const mockIsFunction = require('../../src/type')
    .isFunction as jest.MockedFunction<(value: unknown) => boolean>
  const mockReaddirSync = require('node:fs').readdirSync as jest.MockedFunction<
    (path: string) => string[]
  >

  let tempDir: string
  let generator: BaseGenerator

  beforeEach(async () => {
    jest.clearAllMocks()

    // 创建临时目录
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'base-generator-test-'))

    // 创建生成器实例
    generator = new BaseGenerator(tempDir)

    // Mock 基本行为
    mockPrompts.mockResolvedValue({})
    mockCopyFile.mockResolvedValue(undefined)
    mockCopyFileSync.mockImplementation(() => undefined)
    mockCopyTpl.mockResolvedValue(undefined)
    mockCopyTplSync.mockImplementation(() => undefined)
    mockCopyDirectory.mockResolvedValue(undefined)
    mockCopyDirectorySync.mockImplementation(() => undefined)
    mockIsFunction.mockReturnValue(false)
    mockLogger.warn.mockImplementation(() => undefined)
    mockReaddirSync.mockReturnValue([])

    // Mock console
    jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    try {
      await fsp.rm(tempDir, { recursive: true, force: true })
    } catch {
      // 忽略清理错误
    }
  })

  describe('构造函数', () => {
    it('应该正确初始化基础属性', () => {
      const basedir = '/test/basedir'
      const renderOptions: RenderTemplateOptions = { type: 'mustache' }

      const gen = new BaseGenerator(basedir, renderOptions)

      expect(gen.basedir).toBe(basedir)
      expect(gen.renderTemplateOptions).toEqual(renderOptions)
      expect(gen.prompts).toEqual({})
    })

    it('应该处理函数形式的 basedir', () => {
      const basedirFn = jest.fn().mockReturnValue('/dynamic/basedir')

      const gen = new BaseGenerator(basedirFn)

      expect(gen.basedir).toBe(basedirFn)
    })

    it('应该处理没有渲染选项的情况', () => {
      const gen = new BaseGenerator('/simple/basedir')

      expect(gen.renderTemplateOptions).toBeUndefined()
    })
  })

  describe('run 方法', () => {
    it('应该执行完整的运行流程', async () => {
      const questions: PromptObject[] = [
        { name: 'projectName', message: '项目名称', type: 'text' },
      ]
      const answers = { projectName: 'test-project' }

      // Mock prompting 方法
      generator.prompting = jest.fn().mockReturnValue(questions)
      generator.writing = jest.fn().mockResolvedValue(undefined)
      mockPrompts.mockResolvedValue(answers)

      await generator.run()

      expect(mockPrompts).toHaveBeenCalledWith(questions)
      expect(generator.prompts).toEqual(answers)
      expect(generator.writing).toHaveBeenCalled()
    })

    it('应该处理动态 basedir', async () => {
      const basedirFn = jest.fn().mockReturnValue('/dynamic/path')
      mockIsFunction.mockReturnValue(true)

      const gen = new BaseGenerator(basedirFn)
      gen.prompts = { name: 'test' }
      gen.writing = jest.fn().mockResolvedValue(undefined)

      // 在 run 中会设置 prompts，然后调用 basedirFn
      mockPrompts.mockResolvedValue({ name: 'test' })

      await gen.run()

      expect(basedirFn).toHaveBeenCalledWith({ name: 'test' })
    })
  })

  describe('copyFile 方法', () => {
    it('应该调用底层的 copyFile 并传递选项', async () => {
      const options: CopyFileOptions = { data: { name: 'test' } }

      // 需要先运行 run() 来设置 _basedir
      await generator.run()
      await generator.copyFile(
        '/async-source.txt',
        '/async-target.txt',
        options,
      )

      expect(mockCopyFile).toHaveBeenCalledWith(
        '/async-source.txt',
        '/async-target.txt',
        {
          ...options,
          renderOptions: undefined,
          basedir: tempDir,
        },
      )
    })

    it('应该同步复制文件', async () => {
      // 先运行 run() 来设置 _basedir
      await generator.run()
      generator.copyFileSync('/source.txt', '/target.txt')

      expect(mockCopyFileSync).toHaveBeenCalledWith(
        '/source.txt',
        '/target.txt',
        {
          renderOptions: undefined,
          basedir: tempDir,
        },
      )
    })
  })

  describe('copyTpl 模板方法', () => {
    it('应该调用异步模板复制', async () => {
      const data = { name: 'TestProject', version: '1.0.0' }

      // 先运行 run() 来设置 _basedir
      await generator.run()
      await generator.copyTpl('/template.tpl', '/output.txt', data)

      expect(mockCopyTpl).toHaveBeenCalledWith(
        '/template.tpl',
        '/output.txt',
        data,
        {
          renderOptions: undefined,
          basedir: tempDir,
        },
      )
    })

    it('应该调用同步模板复制', async () => {
      const data = { framework: 'React' }

      // 先运行 run() 来设置 _basedir
      await generator.run()
      generator.copyTplSync('/sync-template.tpl', '/sync-output.txt', data)

      expect(mockCopyTplSync).toHaveBeenCalledWith(
        '/sync-template.tpl',
        '/sync-output.txt',
        data,
        {
          renderOptions: undefined,
          basedir: tempDir,
        },
      )
    })
  })

  describe('copyDirectory 目录方法', () => {
    it('应该调用异步目录复制', async () => {
      const data = { projectType: 'library' }

      // 先运行 run() 来设置 _basedir
      await generator.run()
      await generator.copyDirectory('/template-dir', '/output-dir', data)

      expect(mockCopyDirectory).toHaveBeenCalledWith(
        '/template-dir',
        '/output-dir',
        data,
        {
          renderOptions: undefined,
          basedir: tempDir,
        },
      )
    })

    it('应该调用同步目录复制', async () => {
      const data = { env: 'production' }

      // 先运行 run() 来设置 _basedir
      await generator.run()
      generator.copyDirectorySync('/src-templates', '/build-output', data)

      expect(mockCopyDirectorySync).toHaveBeenCalledWith(
        '/src-templates',
        '/build-output',
        data,
        {
          renderOptions: undefined,
          basedir: tempDir,
        },
      )
    })
  })

  describe('checkDir 目录检查', () => {
    it('应该在空目录时返回 true', async () => {
      mockReaddirSync.mockReturnValue([])

      const result = await generator.checkDir('/empty-dir')

      expect(mockReaddirSync).toHaveBeenCalledWith('/empty-dir')
      expect(result).toBe(true)
    })

    it('应该在只有白名单文件时返回 true', async () => {
      mockReaddirSync.mockReturnValue(['.git', 'LICENSE'])

      const result = await generator.checkDir('/whitelisted-dir')

      expect(result).toBe(true)
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    it('应该在有非白名单文件时询问确认', async () => {
      mockReaddirSync.mockReturnValue([
        '.git',
        'src',
        'package.json',
        'README.md',
      ])
      mockConfirm.mockResolvedValue(true)
      const mockConsoleLog = jest.spyOn(console, 'log')

      const result = await generator.checkDir('/existing-project')

      expect(mockReaddirSync).toHaveBeenCalledWith('/existing-project')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('existing-project'),
      )
      expect(mockConsoleLog).toHaveBeenCalledWith(' - src')
      expect(mockConsoleLog).toHaveBeenCalledWith(' - package.json')
      expect(mockConsoleLog).toHaveBeenCalledWith(' - README.md')
      expect(mockConfirm).toHaveBeenCalledWith('确定要覆盖当前文件夹吗?', true)
      expect(result).toBe(true)
    })

    it('应该在用户拒绝覆盖时返回 false', async () => {
      mockReaddirSync.mockReturnValue(['existing-file.txt'])
      mockConfirm.mockResolvedValue(false)

      const result = await generator.checkDir('/protected-dir')

      expect(mockConfirm).toHaveBeenCalled()
      expect(result).toBe(false)
    })
  })
})
