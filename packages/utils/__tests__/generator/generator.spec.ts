import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest'
import * as importedModule0 from '../../src/file'
import * as importedModule1 from '../../src/guards'

import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import prompts from 'prompts'

import { Generator, type GeneratorOptions } from '../../src/generator'

const requiredModule0 = vi.mocked(importedModule0, { deep: true })
const requiredModule1 = vi.mocked(importedModule1, { deep: true })

// Mock 依赖项
vi.mock('prompts')
vi.mock('../../src/cli')
vi.mock('../../src/file')
vi.mock('../../src/logger')
vi.mock('../../src/guards')

describe('Generator 生成器', () => {
  const mockPrompts = prompts as MockedFunction<typeof prompts>
  const mockIsPathExistsSync =
    requiredModule0.isPathExistsSync as MockedFunction<
      (filePath: string) => boolean
    >
  const mockMkdirSync = requiredModule0.mkdirSync as MockedFunction<
    (dirPath: string) => void
  >
  const mockIsDirectorySync = requiredModule0.isDirectorySync as MockedFunction<
    (filePath: string) => boolean
  >
  const mockCopyFile = requiredModule0.copyFile as unknown as MockedFunction<
    (
      from: string,
      to: string,
      data: Record<string, unknown>,
      options?: unknown,
    ) => Promise<void>
  >
  const mockCopyTpl = requiredModule0.copyTpl as unknown as MockedFunction<
    (
      from: string,
      to: string,
      data: Record<string, unknown>,
      options?: unknown,
    ) => Promise<void>
  >
  const mockCopyDirectory = requiredModule0.copyDirectory as MockedFunction<
    (
      from: string,
      to: string,
      data: Record<string, unknown>,
      options?: unknown,
    ) => Promise<void>
  >
  const mockIsFunction = requiredModule1.isFunction as MockedFunction<
    (value: unknown) => boolean
  >

  let tempDir: string

  beforeEach(async () => {
    vi.clearAllMocks()

    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'generator-test-'))

    // Setup mocks
    mockPrompts.mockResolvedValue({})
    mockIsPathExistsSync.mockReturnValue(false)
    mockMkdirSync.mockImplementation(() => undefined)
    mockIsDirectorySync.mockReturnValue(false)
    mockCopyFile.mockResolvedValue(undefined)
    mockCopyTpl.mockResolvedValue(undefined)
    mockCopyDirectory.mockResolvedValue(undefined)
    mockIsFunction.mockReturnValue(false)
  })

  afterEach(async () => {
    try {
      await fsp.rm(tempDir, { recursive: true, force: true })
    } catch {
      // 忽略清理错误
    }
  })

  describe('构造函数', () => {
    it('应该正确初始化生成器', () => {
      const options: GeneratorOptions = {
        src: '/template/src',
        dest: '/output/dest',
        questions: [{ name: 'name', message: '名称', type: 'text' }],
        data: { framework: 'React' },
      }

      const generator = new Generator(options)

      expect(generator.src).toBe('/template/src')
      expect(generator.dest).toBe('/output/dest')
      expect(generator.questions).toEqual(options.questions)
      expect(generator.data).toEqual(options.data)
    })

    it('应该使用默认值', () => {
      const options: GeneratorOptions = {
        src: '/src',
        dest: '/dest',
      }

      const generator = new Generator(options)

      expect(generator.questions).toEqual([])
      expect(generator.data).toEqual({})
      expect(generator.onGeneratorDone).toBeUndefined()
    })
  })

  describe('run 方法', () => {
    it('应该执行完整的生成流程', async () => {
      const onDone = vi.fn()
      const options: GeneratorOptions = {
        src: '/template',
        dest: '/output',
        questions: [{ name: 'name', message: '名称', type: 'text' }],
        data: { version: '1.0.0' },
        onGeneratorDone: onDone,
      }

      const answers = { name: 'TestProject' }
      mockPrompts.mockResolvedValue(answers)

      const generator = new Generator(options)
      await generator.run()

      expect(mockPrompts).toHaveBeenCalledWith(options.questions)
      expect(onDone).toHaveBeenCalledWith({
        src: '/template', // 字符串形式直接使用
        dest: '/output', // 字符串形式直接使用
        data: { version: '1.0.0' }, // 静态数据，不包含 prompts（因为在 _data 中）
      })
    })
  })

  describe('writing 方法', () => {
    it('应该处理字符串 dest', async () => {
      const options: GeneratorOptions = {
        src: '/template',
        dest: '/output',
      }

      const generator = new Generator(options)
      await generator.writing()

      expect(mockMkdirSync).toHaveBeenCalledWith('/output')
    })

    it('应该处理函数 dest', async () => {
      const destFn = vi.fn().mockReturnValue('/computed/output')
      mockIsFunction.mockReturnValueOnce(true) // dest is function

      const options: GeneratorOptions = {
        src: '/template',
        dest: destFn,
      }

      const generator = new Generator(options)
      generator.prompts = { name: 'test' }
      await generator.writing()

      expect(destFn).toHaveBeenCalledWith({ name: 'test' })
      expect(mockMkdirSync).toHaveBeenCalledWith('/computed/output')
    })

    it('应该根据源类型选择复制方法', async () => {
      // 测试目录复制
      mockIsDirectorySync.mockReturnValue(true)

      const dirOptions: GeneratorOptions = {
        src: '/template-dir',
        dest: '/output-dir',
      }

      const dirGenerator = new Generator(dirOptions)
      await dirGenerator.writing()

      expect(mockCopyDirectory).toHaveBeenCalledWith(
        '/template-dir',
        '/output-dir',
        {},
        expect.any(Object),
      )

      // 重置并测试模板文件
      vi.clearAllMocks()
      mockIsDirectorySync.mockReturnValue(false)

      const tplOptions: GeneratorOptions = {
        src: '/template.tpl',
        dest: '/output.txt',
      }

      const tplGenerator = new Generator(tplOptions)
      await tplGenerator.writing()

      expect(mockCopyTpl).toHaveBeenCalledWith(
        '/template.tpl',
        '/output.txt',
        {},
        expect.any(Object),
      )
    })

    it('应该合并数据', async () => {
      const options: GeneratorOptions = {
        src: '/template.txt',
        dest: '/output.txt',
        data: { static: 'data' },
      }

      const generator = new Generator(options)
      generator.prompts = { dynamic: 'prompt' }

      // Mock 继承的方法
      generator.copyFile = vi.fn().mockResolvedValue(undefined)

      await generator.writing()

      // Generator.writing() 调用的是 this.copyFile (来自 BaseGenerator)
      expect(generator.copyFile).toHaveBeenCalledWith(
        '/template.txt',
        '/output.txt',
        { dynamic: 'prompt', static: 'data' },
      )
    })
  })

  describe('错误处理', () => {
    it('应该处理运行时错误', async () => {
      mockPrompts.mockRejectedValue(new Error('Prompt failed'))

      const generator = new Generator({
        src: '/src',
        dest: '/dest',
        questions: [{ name: 'test', message: 'Test', type: 'text' }],
      })

      await expect(generator.run()).rejects.toThrow('Prompt failed')
    })
  })
})
