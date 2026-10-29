import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest'

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import * as os from 'node:os'
import { EOL } from 'node:os'
import * as path from 'node:path'

import {
  writeFile,
  writeFileAtomic,
  writeFileAtomicSync,
  writeFileSync,
  writeJson,
  writeJsonAtomic,
  writeJsonAtomicSync,
  writeJsonSync,
  type WriteFileSyncOptions,
} from '../../src/file/write'

describe('文件写入工具', () => {
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

    it('应该通过选项对象指定编码并追加内容', async () => {
      await writeFile(testFile, '你好', { encoding: 'utf16le' })
      await writeFile(testFile, '世界', {
        encoding: 'utf16le',
        flag: 'a',
      })

      expect(await fsp.readFile(testFile, 'utf16le')).toBe('你好世界')
    })

    it('应该仅创建新文件并保留已存在文件及错误码', async () => {
      const options = Object.freeze({ flag: 'wx' })
      await writeFile(testFile, '原始内容', options)

      await expect(
        writeFile(testFile, '替换内容', options),
      ).rejects.toMatchObject({
        code: 'EEXIST',
        message: expect.stringContaining(`Write ${testFile} failed:`),
      })
      expect(await fsp.readFile(testFile, 'utf8')).toBe('原始内容')
    })

    it('应该透传异步写入的取消信号', async () => {
      const controller = new AbortController()
      controller.abort()

      await expect(
        writeFile(testFile, 'content', { signal: controller.signal }),
      ).rejects.toMatchObject({
        code: 'ABORT_ERR',
        message: expect.stringContaining(`Write ${testFile} failed:`),
      })
      expect(fs.existsSync(testFile)).toBe(false)
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
    it('公开同步类型兼容编码和 null，拒绝来自变量的取消信号', () => {
      expectTypeOf(writeFileSync)
        .parameter(2)
        .toEqualTypeOf<WriteFileSyncOptions | undefined>()
      const options = { signal: new AbortController().signal }
      // @ts-expect-error 同步写入类型拒绝带取消信号的变量
      const invalid: WriteFileSyncOptions = options
      fs.writeFileSync(testFile, 'keep')
      expect(() => writeFileSync(testFile, 'replace', invalid)).toThrow(
        /do not support signal/,
      )
      expect(fs.readFileSync(testFile, 'utf8')).toBe('keep')
      fs.unlinkSync(testFile)
      expect(() => writeFileSync(testFile, 'new', invalid)).toThrow(
        /do not support signal/,
      )
      expect(fs.readdirSync(tempDir)).toEqual([])
      writeFileSync(testFile, 'null encoding', null)
      expect(fs.readFileSync(testFile, 'utf8')).toBe('null encoding')
    })

    it('应该同步写入文件内容', () => {
      const content = 'Sync content'

      writeFileSync(testFile, content)

      expect(fs.existsSync(testFile)).toBe(true)
      expect(fs.readFileSync(testFile, 'utf8')).toBe(content)
    })

    it('应该兼容编码字符串并通过选项对象追加内容', () => {
      writeFileSync(testFile, '你好', 'utf16le')
      writeFileSync(testFile, '世界', {
        encoding: 'utf16le',
        flag: 'a',
      })

      expect(fs.readFileSync(testFile, 'utf16le')).toBe('你好世界')
    })

    it('应该同步仅创建新文件并保留已存在文件及错误码', () => {
      const options = Object.freeze({ flag: 'wx' })
      writeFileSync(testFile, '原始内容', options)

      expect(() => writeFileSync(testFile, '替换内容', options)).toThrow(
        expect.objectContaining({
          code: 'EEXIST',
          message: expect.stringContaining(`Write ${testFile} failed:`),
        }),
      )
      expect(fs.readFileSync(testFile, 'utf8')).toBe('原始内容')
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

  describe('writeFileAtomic 安全文件写入', () => {
    it('新名称应该原子写入文件', async () => {
      await writeFileAtomic(testFile, 'atomic')
      expect(await fsp.readFile(testFile, 'utf8')).toBe('atomic')
    })

    it('应该安全写入文件', async () => {
      const content = 'Safe content'

      await writeFileAtomic(testFile, content)

      expect(fs.existsSync(testFile)).toBe(true)
      expect(await fsp.readFile(testFile, 'utf8')).toBe(content)
    })

    it('应该在失败时清理临时文件', async () => {
      const invalidTarget = tempDir

      await expect(writeFileAtomic(invalidTarget, 'content')).rejects.toThrow()

      const siblingNames = await fsp.readdir(path.dirname(tempDir))
      expect(
        siblingNames.some(name =>
          name.startsWith(`${path.basename(tempDir)}.`),
        ),
      ).toBe(false)
    })

    it('清理失败时应该同时保留写入错误和清理错误', async () => {
      const writeError = new Error('rename failed')
      const cleanupError = new Error('cleanup failed')
      vi.spyOn(fsp, 'rename').mockRejectedValueOnce(writeError)
      vi.spyOn(fsp, 'unlink').mockRejectedValueOnce(cleanupError)

      const error = await writeFileAtomic(testFile, 'content').catch(
        value => value,
      )

      expect(error).toBeInstanceOf(AggregateError)
      expect((error as AggregateError).errors).toEqual([
        writeError,
        cleanupError,
      ])
      expect((error as AggregateError).cause).toBe(cleanupError)
    })

    it('应该使用指定编码安全写入', async () => {
      const content = 'Content with encoding'

      await writeFileAtomic(testFile, content, 'ascii')

      expect(fs.existsSync(testFile)).toBe(true)
    })

    it('应该通过选项对象替换内容并设置编码和权限', async () => {
      await fsp.writeFile(testFile, 'original')
      const options = Object.freeze({
        encoding: 'utf16le' as const,
        mode: 0o600,
        flush: true,
      })

      await writeFileAtomic(testFile, '原子内容', options)

      expect(await fsp.readFile(testFile, 'utf16le')).toBe('原子内容')
      if (process.platform !== 'win32') {
        expect(fs.statSync(testFile).mode & 0o777).toBe(
          0o600 & ~process.umask(),
        )
      }
    })

    it('写入完成后收到取消时不替换目标并清理临时文件', async () => {
      await fsp.writeFile(testFile, 'original')
      const controller = new AbortController()
      const reason = new Error('cancel before rename')
      const originalWrite = fsp.writeFile
      vi.spyOn(fsp, 'writeFile').mockImplementationOnce(async (...args) => {
        await originalWrite(...args)
        controller.abort(reason)
      })
      const rename = vi.spyOn(fsp, 'rename')

      await expect(
        writeFileAtomic(testFile, 'replacement', {
          signal: controller.signal,
        }),
      ).rejects.toBe(reason)

      expect(rename).not.toHaveBeenCalled()
      expect(await fsp.readFile(testFile, 'utf8')).toBe('original')
      expect(await fsp.readdir(tempDir)).toEqual([path.basename(testFile)])
    })
  })

  describe('writeFileAtomicSync 同步安全文件写入', () => {
    it('新名称应该同步原子写入文件', () => {
      writeFileAtomicSync(testFile, 'atomic-sync')
      expect(fs.readFileSync(testFile, 'utf8')).toBe('atomic-sync')
    })

    it('应该同步安全写入文件', () => {
      const content = 'Sync safe content'

      writeFileAtomicSync(testFile, content)

      expect(fs.existsSync(testFile)).toBe(true)
      expect(fs.readFileSync(testFile, 'utf8')).toBe(content)
    })

    it('应该在同步失败时清理临时文件', () => {
      const invalidTarget = tempDir

      expect(() => writeFileAtomicSync(invalidTarget, 'content')).toThrow()
      const siblingNames = fs.readdirSync(path.dirname(tempDir))
      expect(
        siblingNames.some(name =>
          name.startsWith(`${path.basename(tempDir)}.`),
        ),
      ).toBe(false)
    })

    it('同步清理失败时应该同时保留写入错误和清理错误', () => {
      const writeError = new Error('rename failed')
      const cleanupError = new Error('cleanup failed')
      vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
        throw writeError
      })
      vi.spyOn(fs, 'unlinkSync').mockImplementationOnce(() => {
        throw cleanupError
      })

      let thrown: unknown
      try {
        writeFileAtomicSync(testFile, 'content')
      } catch (error) {
        thrown = error
      }

      expect(thrown).toBeInstanceOf(AggregateError)
      expect((thrown as AggregateError).errors).toEqual([
        writeError,
        cleanupError,
      ])
      expect((thrown as AggregateError).cause).toBe(cleanupError)
    })

    it('应该兼容编码字符串并支持编码和 flush 选项', () => {
      writeFileAtomicSync(testFile, '原始内容', 'utf16le')
      expect(fs.readFileSync(testFile, 'utf16le')).toBe('原始内容')

      writeFileAtomicSync(testFile, '替换内容', {
        encoding: 'utf16le',
        mode: 0o600,
        flush: true,
      })
      expect(fs.readFileSync(testFile, 'utf16le')).toBe('替换内容')
      if (process.platform !== 'win32') {
        expect(fs.statSync(testFile).mode & 0o777).toBe(
          0o600 & ~process.umask(),
        )
      }
    })

    it('同步与异步原子写入都拒绝独占创建和追加标志', async () => {
      await fsp.writeFile(testFile, 'original')

      for (const flag of ['wx', 'a']) {
        // @ts-expect-error 原子替换不接受原生写入标志
        const result = writeFileAtomic(testFile, 'replacement', { flag })
        await expect(result).rejects.toThrow(
          'Atomic writes do not support the flag option',
        )
        const write = () => {
          // @ts-expect-error 同步原子替换同样不接受写入标志
          writeFileAtomicSync(testFile, 'replacement', { flag })
        }
        expect(write).toThrow('Atomic writes do not support the flag option')
      }

      expect(fs.readFileSync(testFile, 'utf8')).toBe('original')
      expect(fs.readdirSync(tempDir)).toEqual([path.basename(testFile)])
    })

    it('同步原子写入拒绝取消信号', () => {
      const write = () => {
        writeFileAtomicSync(testFile, 'content', {
          // @ts-expect-error 同步原子写入不支持取消信号
          signal: new AbortController().signal,
        })
      }

      expect(write).toThrow('Synchronous atomic writes do not support signal')
      expect(fs.readdirSync(tempDir)).toEqual([])
    })
  })

  describe('writeJsonAtomic 安全JSON写入', () => {
    it('新名称应该原子写入 JSON', async () => {
      await writeJsonAtomic(testJsonFile, { mode: 'atomic' })
      expect(JSON.parse(await fsp.readFile(testJsonFile, 'utf8'))).toEqual({
        mode: 'atomic',
      })
    })

    it('应该安全写入JSON文件', async () => {
      interface TestData {
        safe: boolean
        data: string
      }

      const data: TestData = { safe: true, data: 'test' }

      await writeJsonAtomic(testJsonFile, data)

      expect(fs.existsSync(testJsonFile)).toBe(true)
      const content = await fsp.readFile(testJsonFile, 'utf8')
      expect(content).toBe(JSON.stringify(data, null, 2) + EOL)
    })

    it('应该在JSON安全写入失败时清理临时文件', async () => {
      const invalidTarget = tempDir

      await expect(writeJsonAtomic(invalidTarget, {})).rejects.toThrow()
      const siblingNames = await fsp.readdir(path.dirname(tempDir))
      expect(
        siblingNames.some(name =>
          name.startsWith(`${path.basename(tempDir)}.`),
        ),
      ).toBe(false)
    })
  })

  describe('writeJsonAtomicSync 同步安全JSON写入', () => {
    it('新名称应该同步原子写入 JSON', () => {
      writeJsonAtomicSync(testJsonFile, { mode: 'atomic-sync' })
      expect(JSON.parse(fs.readFileSync(testJsonFile, 'utf8'))).toEqual({
        mode: 'atomic-sync',
      })
    })

    it('应该同步安全写入JSON文件', () => {
      const data = { syncSafe: true, test: 'data' }

      writeJsonAtomicSync(testJsonFile, data)

      expect(fs.existsSync(testJsonFile)).toBe(true)
      const content = fs.readFileSync(testJsonFile, 'utf8')
      expect(content).toBe(JSON.stringify(data, null, 2) + EOL)
    })

    it('应该在同步JSON安全写入失败时清理临时文件', () => {
      const invalidTarget = tempDir

      expect(() => writeJsonAtomicSync(invalidTarget, {})).toThrow()
      const siblingNames = fs.readdirSync(path.dirname(tempDir))
      expect(
        siblingNames.some(name =>
          name.startsWith(`${path.basename(tempDir)}.`),
        ),
      ).toBe(false)
    })
  })

  describe('JSON 序列化失败不修改文件', () => {
    it.each([
      ['async', writeJson],
      ['sync', writeJsonSync],
      ['atomic async', writeJsonAtomic],
      ['atomic sync', writeJsonAtomicSync],
    ] as const)(
      '%s 在序列化未产生值时保留目标且不留下临时文件',
      async (_kind, write) => {
        fs.writeFileSync(testJsonFile, 'keep')
        const data = { toJSON: () => undefined }
        await expect(
          Promise.resolve().then(() => write(testJsonFile, data)),
        ).rejects.toThrow(TypeError)
        expect(fs.readFileSync(testJsonFile, 'utf8')).toBe('keep')
        expect(fs.readdirSync(tempDir)).toEqual([path.basename(testJsonFile)])
        fs.unlinkSync(testJsonFile)
        await expect(
          Promise.resolve().then(() => write(testJsonFile, data)),
        ).rejects.toThrow(TypeError)
        expect(fs.readdirSync(tempDir)).toEqual([])
      },
    )
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
