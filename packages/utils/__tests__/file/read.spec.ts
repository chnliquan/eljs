/* eslint-disable @typescript-eslint/no-var-requires */
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import parseJson from 'parse-json'

import {
  readFile,
  readFileSync,
  readJson,
  readJsonSync,
} from '../../src/file/read'

// Mock 依赖项
jest.mock('parse-json')

describe('文件读取工具', () => {
  const mockParseJson = parseJson as jest.MockedFunction<typeof parseJson>

  let tempDir: string
  let testFile: string
  let testJsonFile: string

  beforeEach(async () => {
    jest.clearAllMocks()

    // 创建临时目录
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'read-test-'))
    testFile = path.join(tempDir, 'test.txt')
    testJsonFile = path.join(tempDir, 'test.json')

    // 创建测试文件
    await fsp.writeFile(testFile, 'Hello World!')
    await fsp.writeFile(
      testJsonFile,
      JSON.stringify({ name: 'test', version: '1.0.0' }),
    )
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    try {
      await fsp.rm(tempDir, { recursive: true, force: true })
    } catch {
      // 忽略清理错误
    }
  })

  describe('readFile 异步文件读取', () => {
    it('应该读取文件内容', async () => {
      const content = await readFile(testFile)

      expect(content).toBe('Hello World!')
    })

    it('应该使用指定的编码读取文件', async () => {
      const binaryFile = path.join(tempDir, 'binary.txt')
      await fsp.writeFile(binaryFile, Buffer.from('binary content'))

      const content = await readFile(binaryFile, 'ascii')

      expect(typeof content).toBe('string')
      expect(content).toBe('binary content')
    })

    it('应该在文件不存在时抛出错误', async () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.txt')

      await expect(readFile(nonExistentFile)).rejects.toThrow(/Read .* failed/)
    })

    it('应该在读取失败时包含文件路径', async () => {
      const invalidPath = '/invalid/path/file.txt'

      try {
        await readFile(invalidPath)
        fail('应该抛出错误')
      } catch (error) {
        expect((error as Error).message).toContain(invalidPath)
        expect((error as Error).message).toContain('Read')
        expect((error as Error).message).toContain('failed')
      }
    })
  })

  describe('readFileSync 同步文件读取', () => {
    it('应该同步读取文件内容', () => {
      const content = readFileSync(testFile)

      expect(content).toBe('Hello World!')
    })

    it('应该使用指定的编码同步读取文件', () => {
      const content = readFileSync(testFile, 'utf8')

      expect(content).toBe('Hello World!')
    })

    it('应该在同步读取失败时抛出错误', () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.txt')

      expect(() => readFileSync(nonExistentFile)).toThrow(/Read .* failed/)
    })
  })

  describe('readJson 异步JSON读取', () => {
    beforeEach(() => {
      // Mock parseJson 的默认行为
      mockParseJson.mockImplementation((input: string | null) => {
        if (input === null) throw new Error('Input is null')
        return JSON.parse(input)
      })
    })

    it('应该读取并解析JSON文件', async () => {
      interface TestJson {
        name: string
        version: string
      }

      const result = await readJson<TestJson>(testJsonFile)

      expect(result).toEqual({ name: 'test', version: '1.0.0' })
      expect(mockParseJson).toHaveBeenCalledWith(
        '{"name":"test","version":"1.0.0"}',
      )
    })

    it('应该在JSON解析失败时抛出错误', async () => {
      const invalidJsonFile = path.join(tempDir, 'invalid.json')
      await fsp.writeFile(invalidJsonFile, '{ invalid json }')

      mockParseJson.mockImplementation(() => {
        throw new Error('JSON parse error')
      })

      await expect(readJson(invalidJsonFile)).rejects.toThrow(/Parse .* failed/)
    })

    it('应该在文件读取失败时抛出错误', async () => {
      const nonExistentJson = path.join(tempDir, 'nonexistent.json')

      await expect(readJson(nonExistentJson)).rejects.toThrow(/Read .* failed/)
    })

    it('应该保持泛型类型', async () => {
      interface CustomType {
        customField: string
        customNumber: number
      }

      const customJsonFile = path.join(tempDir, 'custom.json')
      await fsp.writeFile(
        customJsonFile,
        JSON.stringify({ customField: 'test', customNumber: 42 }),
      )

      const result = await readJson<CustomType>(customJsonFile)

      // TypeScript 应该知道这些属性的类型
      expect(result.customField).toBe('test')
      expect(result.customNumber).toBe(42)
    })
  })

  describe('readJsonSync 同步JSON读取', () => {
    beforeEach(() => {
      mockParseJson.mockImplementation((input: string | null) => {
        if (input === null) throw new Error('Input is null')
        return JSON.parse(input)
      })
    })

    it('应该同步读取并解析JSON文件', () => {
      interface TestJson {
        name: string
        version: string
      }

      const result = readJsonSync<TestJson>(testJsonFile)

      expect(result).toEqual({ name: 'test', version: '1.0.0' })
      expect(mockParseJson).toHaveBeenCalledWith(
        '{"name":"test","version":"1.0.0"}',
      )
    })

    it('应该在同步JSON解析失败时抛出错误', () => {
      mockParseJson.mockImplementation(() => {
        throw new Error('JSON parse error')
      })

      expect(() => readJsonSync(testJsonFile)).toThrow(/Parse .* failed/)
    })

    it('应该在同步文件读取失败时抛出错误', () => {
      const nonExistentJson = path.join(tempDir, 'nonexistent.json')

      expect(() => readJsonSync(nonExistentJson)).toThrow(/Read .* failed/)
    })
  })

  describe('边界情况和错误处理', () => {
    it('应该处理空文件', async () => {
      const emptyFile = path.join(tempDir, 'empty.txt')
      await fsp.writeFile(emptyFile, '')

      const content = await readFile(emptyFile)
      expect(content).toBe('')
    })

    it('应该处理大文件', async () => {
      const largeContent = 'x'.repeat(10000)
      const largeFile = path.join(tempDir, 'large.txt')
      await fsp.writeFile(largeFile, largeContent)

      const content = await readFile(largeFile)
      expect(content).toBe(largeContent)
      expect(content.length).toBe(10000)
    })

    it('应该处理包含特殊字符的文件', async () => {
      const specialContent = '特殊字符 🎉 emoji \n\t tabs and newlines'
      const specialFile = path.join(tempDir, 'special.txt')
      await fsp.writeFile(specialFile, specialContent)

      const content = await readFile(specialFile)
      expect(content).toBe(specialContent)
    })
  })
})
