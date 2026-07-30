import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest'
import * as importedModule0 from '../../src/file/is'

import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import { EOL } from 'node:os'
import * as path from 'node:path'

import {
  safeWriteFile,
  safeWriteFileSync,
  safeWriteJson,
  safeWriteJsonSync,
  writeFile,
  writeFileSync,
  writeJson,
  writeJsonSync,
} from '../../src/file/write'

const requiredModule0 = vi.mocked(importedModule0, { deep: true })

// Mock 依赖项
vi.mock('../../src/file/is')

describe('文件写入工具', () => {
  const mockIsPathExists = requiredModule0.isPathExists as MockedFunction<
    (filePath: string) => Promise<boolean>
  >
  const mockIsPathExistsSync =
    requiredModule0.isPathExistsSync as MockedFunction<
      (filePath: string) => boolean
    >

  let tempDir: string
  let testFile: string
  let testJsonFile: string

  beforeEach(async () => {
    vi.clearAllMocks()

    // 创建临时目录
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'write-test-'))
    testFile = path.join(tempDir, 'test.txt')
    testJsonFile = path.join(tempDir, 'test.json')
  })

  afterEach(async () => {
    vi.restoreAllMocks()

    try {
      await fsp.rm(tempDir, { recursive: true, force: true })
    } catch {
      // 忽略清理错误
    }
  })

  describe('writeFile 异步文件写入', () => {
    it('应该写入文件内容', async () => {
      const content = 'Hello World!'

      await writeFile(testFile, content)

      expect(fs.existsSync(testFile)).toBe(true)
      expect(await fsp.readFile(testFile, 'utf8')).toBe(content)
    })

    it('应该使用指定的编码写入文件', async () => {
      const content = 'Test content with encoding'

      await writeFile(testFile, content, 'ascii')

      expect(fs.existsSync(testFile)).toBe(true)
      expect(await fsp.readFile(testFile, 'ascii')).toBe(content)
    })

    it('应该在写入失败时抛出错误', async () => {
      const invalidPath = '/invalid/readonly/path/file.txt'

      await expect(writeFile(invalidPath, 'content')).rejects.toThrow(
        /Write .* failed/,
      )
    })

    it('应该在错误消息中包含文件路径', async () => {
      const invalidPath = '/invalid/path/test.txt'

      try {
        await writeFile(invalidPath, 'content')
        throw new Error('应该抛出错误')
      } catch (error) {
        expect((error as Error).message).toContain(invalidPath)
        expect((error as Error).message).toContain('Write')
        expect((error as Error).message).toContain('failed')
      }
    })
  })

  describe('writeFileSync 同步文件写入', () => {
    it('应该同步写入文件内容', () => {
      const content = 'Sync content'

      writeFileSync(testFile, content)

      expect(fs.existsSync(testFile)).toBe(true)
      expect(fs.readFileSync(testFile, 'utf8')).toBe(content)
    })

    it('应该在同步写入失败时抛出错误', () => {
      const invalidPath = '/invalid/readonly/path/file.txt'

      expect(() => writeFileSync(invalidPath, 'content')).toThrow(
        /Write .* failed/,
      )
    })
  })

  describe('writeJson 异步JSON写入', () => {
    it('应该写入JSON对象到文件', async () => {
      interface TestData {
        name: string
        version: string
        active: boolean
      }

      const data: TestData = { name: 'test', version: '1.0.0', active: true }

      await writeJson(testJsonFile, data)

      expect(fs.existsSync(testJsonFile)).toBe(true)
      const content = await fsp.readFile(testJsonFile, 'utf8')
      expect(content).toBe(JSON.stringify(data, null, 2) + EOL)
    })

    it('应该处理复杂的JSON结构', async () => {
      interface ComplexData {
        metadata: {
          author: string
          tags: string[]
        }
        config: {
          enabled: boolean
          timeout: number
        }
      }

      const complexData: ComplexData = {
        metadata: {
          author: 'test-author',
          tags: ['tag1', 'tag2'],
        },
        config: {
          enabled: true,
          timeout: 5000,
        },
      }

      await writeJson(testJsonFile, complexData)

      const content = await fsp.readFile(testJsonFile, 'utf8')
      const parsed = JSON.parse(content)
      expect(parsed).toEqual(complexData)
    })

    it('应该在JSON写入失败时抛出错误', async () => {
      const invalidPath = '/invalid/path/test.json'

      await expect(writeJson(invalidPath, {})).rejects.toThrow(
        /Write .* failed/,
      )
    })
  })

  describe('writeJsonSync 同步JSON写入', () => {
    it('应该同步写入JSON对象到文件', () => {
      const data = { sync: true, test: 'data' }

      writeJsonSync(testJsonFile, data)

      expect(fs.existsSync(testJsonFile)).toBe(true)
      const content = fs.readFileSync(testJsonFile, 'utf8')
      expect(content).toBe(JSON.stringify(data, null, 2) + EOL)
    })

    it('应该在同步JSON写入失败时抛出错误', () => {
      const invalidPath = '/invalid/path/test.json'

      expect(() => writeJsonSync(invalidPath, {})).toThrow(/Write .* failed/)
    })
  })

  describe('safeWriteFile 安全文件写入', () => {
    beforeEach(() => {
      mockIsPathExists.mockResolvedValue(false)
    })

    it('应该安全写入文件', async () => {
      const content = 'Safe content'

      await safeWriteFile(testFile, content)

      expect(fs.existsSync(testFile)).toBe(true)
      expect(await fsp.readFile(testFile, 'utf8')).toBe(content)
    })

    it('应该在失败时清理临时文件', async () => {
      mockIsPathExists.mockResolvedValue(true)

      // 创建一个会导致重命名失败的场景
      const invalidTarget = path.join(tempDir, 'readonly', 'test.txt')

      await expect(safeWriteFile(invalidTarget, 'content')).rejects.toThrow()

      // 应该尝试清理临时文件
      expect(mockIsPathExists).toHaveBeenCalled()
    })

    it('应该使用指定编码安全写入', async () => {
      const content = 'Content with encoding'

      await safeWriteFile(testFile, content, 'ascii')

      expect(fs.existsSync(testFile)).toBe(true)
    })
  })

  describe('safeWriteFileSync 同步安全文件写入', () => {
    beforeEach(() => {
      mockIsPathExistsSync.mockReturnValue(false)
    })

    it('应该同步安全写入文件', () => {
      const content = 'Sync safe content'

      safeWriteFileSync(testFile, content)

      expect(fs.existsSync(testFile)).toBe(true)
      expect(fs.readFileSync(testFile, 'utf8')).toBe(content)
    })

    it('应该在同步失败时清理临时文件', () => {
      mockIsPathExistsSync.mockReturnValue(true)

      const invalidTarget = path.join(tempDir, 'readonly', 'test.txt')

      expect(() => safeWriteFileSync(invalidTarget, 'content')).toThrow()
      expect(mockIsPathExistsSync).toHaveBeenCalled()
    })
  })

  describe('safeWriteJson 安全JSON写入', () => {
    beforeEach(() => {
      mockIsPathExists.mockResolvedValue(false)
    })

    it('应该安全写入JSON文件', async () => {
      interface TestData {
        safe: boolean
        data: string
      }

      const data: TestData = { safe: true, data: 'test' }

      await safeWriteJson(testJsonFile, data)

      expect(fs.existsSync(testJsonFile)).toBe(true)
      const content = await fsp.readFile(testJsonFile, 'utf8')
      expect(content).toBe(JSON.stringify(data, null, 2) + EOL)
    })

    it('应该在JSON安全写入失败时清理临时文件', async () => {
      mockIsPathExists.mockResolvedValue(true)

      const invalidTarget = path.join(tempDir, 'readonly', 'test.json')

      await expect(safeWriteJson(invalidTarget, {})).rejects.toThrow()
      expect(mockIsPathExists).toHaveBeenCalled()
    })
  })

  describe('safeWriteJsonSync 同步安全JSON写入', () => {
    beforeEach(() => {
      mockIsPathExistsSync.mockReturnValue(false)
    })

    it('应该同步安全写入JSON文件', () => {
      const data = { syncSafe: true, test: 'data' }

      safeWriteJsonSync(testJsonFile, data)

      expect(fs.existsSync(testJsonFile)).toBe(true)
      const content = fs.readFileSync(testJsonFile, 'utf8')
      expect(content).toBe(JSON.stringify(data, null, 2) + EOL)
    })

    it('应该在同步JSON安全写入失败时清理临时文件', () => {
      mockIsPathExistsSync.mockReturnValue(true)

      const invalidTarget = path.join(tempDir, 'readonly', 'test.json')

      expect(() => safeWriteJsonSync(invalidTarget, {})).toThrow()
      expect(mockIsPathExistsSync).toHaveBeenCalled()
    })
  })

  describe('边界情况和错误处理', () => {
    it('应该处理空内容写入', async () => {
      await writeFile(testFile, '')

      expect(fs.existsSync(testFile)).toBe(true)
      expect(await fsp.readFile(testFile, 'utf8')).toBe('')
    })

    it('应该处理大内容写入', async () => {
      const largeContent = 'x'.repeat(100000)

      await writeFile(testFile, largeContent)

      expect(await fsp.readFile(testFile, 'utf8')).toBe(largeContent)
    })

    it('应该处理包含特殊字符的内容', async () => {
      const specialContent = '特殊字符 🎉 emoji \n\t tabs and newlines'

      await writeFile(testFile, specialContent)

      expect(await fsp.readFile(testFile, 'utf8')).toBe(specialContent)
    })

    it('应该处理嵌套目录的文件写入', async () => {
      const nestedFile = path.join(tempDir, 'nested', 'deep', 'file.txt')

      // 确保目录不存在
      expect(fs.existsSync(path.dirname(nestedFile))).toBe(false)

      // 创建嵌套目录
      await fsp.mkdir(path.dirname(nestedFile), { recursive: true })

      await writeFile(nestedFile, 'nested content')

      expect(fs.existsSync(nestedFile)).toBe(true)
      expect(await fsp.readFile(nestedFile, 'utf8')).toBe('nested content')
    })
  })
})
