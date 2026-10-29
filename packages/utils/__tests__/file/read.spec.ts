import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
  type MockedFunction,
} from 'vitest'

import { constants } from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  readFile,
  readFileSync,
  readJson,
  readJsonSync,
  type ReadFileOptions,
  type ReadFileSyncOptions,
} from '../../src/file/read'

const loaderDependencies = vi.hoisted(() => ({
  parseJson: vi.fn(),
}))

vi.mock('../../src/internal/lazy-dependencies', () => ({
  loadParseJson: () => loaderDependencies.parseJson,
}))

describe('文件读取工具', () => {
  const mockParseJson = loaderDependencies.parseJson as MockedFunction<
    typeof import('parse-json').default
  >

  let tempDir: string
  let testFile: string
  let testJsonFile: string

  beforeEach(async () => {
    vi.clearAllMocks()

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
    vi.restoreAllMocks()
    try {
      await fsp.rm(tempDir, { recursive: true, force: true })
    } catch {
      // 忽略清理错误
    }
  })

  describe('读取选项与返回类型', () => {
    it('省略选项或编码时始终使用 UTF-8 且不修改选项', async () => {
      const text = '默认 UTF-8 文本'
      await fsp.writeFile(testFile, text)
      const options = Object.freeze({ flag: 'r' })
      const undefinedEncoding = Object.freeze({
        encoding: undefined,
        flag: 'r',
      })
      const defaultRead = readFile(testFile)
      expectTypeOf(defaultRead).toEqualTypeOf<Promise<string>>()
      expectTypeOf(readFileSync(testFile)).toEqualTypeOf<string>()
      expectTypeOf(readFile(testFile, options)).toEqualTypeOf<Promise<string>>()
      expectTypeOf(readFileSync(testFile, options)).toEqualTypeOf<string>()
      expectTypeOf(readFile(testFile, undefinedEncoding)).toEqualTypeOf<
        Promise<string>
      >()
      expectTypeOf(
        readFileSync(testFile, undefinedEncoding),
      ).toEqualTypeOf<string>()

      expect(await defaultRead).toBe(text)
      for (const option of [undefined, {}, options, undefinedEncoding]) {
        expect(await readFile(testFile, option)).toBe(text)
        expect(readFileSync(testFile, option)).toBe(text)
      }
      expect(options).toEqual({ flag: 'r' })
      expect(undefinedEncoding).toEqual({ encoding: undefined, flag: 'r' })
    })

    it('字符串和对象编码均返回准确的文本类型并转发 flag', async () => {
      const bytes = Buffer.from([0, 0x80, 0xff, 0x41])
      await fsp.writeFile(testFile, bytes)
      const options = Object.freeze({ encoding: 'hex', flag: 'r+' } as const)
      const read = readFile(testFile, options)
      expectTypeOf(read).toEqualTypeOf<Promise<string>>()
      expectTypeOf(readFileSync(testFile, options)).toEqualTypeOf<string>()
      expectTypeOf(readFile(testFile, 'hex')).toEqualTypeOf<Promise<string>>()
      expectTypeOf(readFileSync(testFile, 'hex')).toEqualTypeOf<string>()
      expect(await read).toBe('0080ff41')
      expect(readFileSync(testFile, options)).toBe('0080ff41')
      expect(await readFile(testFile, 'hex')).toBe('0080ff41')
      expect(readFileSync(testFile, 'hex')).toBe('0080ff41')
      expect(
        await readFile(testFile, { encoding: 'hex', flag: constants.O_RDONLY }),
      ).toBe('0080ff41')
      expect(options).toEqual({ encoding: 'hex', flag: 'r+' })
    })

    it('显式 null 或对象 null 编码均返回原始 Buffer', async () => {
      const bytes = Buffer.from([0, 0x80, 0xff, 0x41])
      await fsp.writeFile(testFile, bytes)
      const options = Object.freeze({ encoding: null, flag: 'r' })
      const raw = readFile(testFile, null)
      const objectRaw = readFile(testFile, options)
      expectTypeOf(raw).toEqualTypeOf<Promise<Buffer>>()
      expectTypeOf(objectRaw).toEqualTypeOf<Promise<Buffer>>()
      expectTypeOf(readFileSync(testFile, null)).toEqualTypeOf<Buffer>()
      expectTypeOf(readFileSync(testFile, options)).toEqualTypeOf<Buffer>()
      expect(await raw).toEqual(bytes)
      expect(await objectRaw).toEqual(bytes)
      expect(readFileSync(testFile, null)).toEqual(bytes)
      expect(readFileSync(testFile, options)).toEqual(bytes)
      expect(options).toEqual({ encoding: null, flag: 'r' })
    })

    it('动态选项保留 string 与 Buffer 联合类型及实际行为', async () => {
      async function check(
        options: BufferEncoding | ReadFileOptions | null | undefined,
        syncOptions: BufferEncoding | ReadFileSyncOptions | null | undefined,
        expected: string | Buffer,
      ) {
        const read = readFile(testFile, options)
        const syncRead = readFileSync(testFile, syncOptions)
        expectTypeOf(read).toEqualTypeOf<Promise<string | Buffer>>()
        expectTypeOf(syncRead).toEqualTypeOf<string | Buffer>()
        expect(await read).toEqual(expected)
        expect(syncRead).toEqual(expected)
      }

      for (const options of [
        undefined,
        'utf8',
        {},
        { encoding: undefined },
        { encoding: 'utf8' },
      ] as const) {
        await check(options, options, 'Hello World!')
      }
      await check(null, null, Buffer.from('Hello World!'))
      await check(
        { encoding: null },
        { encoding: null },
        Buffer.from('Hello World!'),
      )
      async function checkObject(
        options: ReadFileOptions,
        syncOptions: ReadFileSyncOptions,
      ) {
        const read = readFile(testFile, options)
        const syncRead = readFileSync(testFile, syncOptions)
        expectTypeOf(read).toEqualTypeOf<Promise<string | Buffer>>()
        expectTypeOf(syncRead).toEqualTypeOf<string | Buffer>()
        expect(await read).toEqual(syncRead)
      }
      await checkObject({}, {})
      await checkObject({ encoding: null }, { encoding: null })
      expectTypeOf<ReadFileOptions>().toHaveProperty('signal')
      expectTypeOf<ReadFileSyncOptions>().not.toHaveProperty('signal')
      expectTypeOf<ReadFileOptions['flag']>().toEqualTypeOf<
        string | number | undefined
      >()
      expectTypeOf<ReadFileSyncOptions['flag']>().toEqualTypeOf<
        string | undefined
      >()
    })

    it('转发异步 signal 并保留取消错误的名称、错误码与原因', async () => {
      const controller = new AbortController()
      const options = Object.freeze({ signal: controller.signal, flag: 'r' })
      expect(await readFile(testFile, options)).toBe('Hello World!')
      const reason = new Error('停止读取')
      controller.abort(reason)

      for (const encoding of [undefined, 'utf8', null] as const) {
        await expect(
          readFile(testFile, { ...options, encoding }),
        ).rejects.toMatchObject({
          name: 'AbortError',
          code: 'ABORT_ERR',
          cause: reason,
          message: expect.stringContaining(`Read ${testFile} failed:`),
        })
      }
      expect(options).toEqual({ signal: controller.signal, flag: 'r' })
    })

    it('选项读取失败仍保留错误码与路径前缀', async () => {
      const missing = path.join(tempDir, 'missing.txt')
      await expect(
        readFile(missing, { encoding: null, flag: 'r' }),
      ).rejects.toMatchObject({
        code: 'ENOENT',
        message: expect.stringContaining(`Read ${missing} failed:`),
      })
      expect(() =>
        readFileSync(missing, { encoding: null, flag: 'r' }),
      ).toThrow(
        expect.objectContaining({
          code: 'ENOENT',
          message: expect.stringContaining(`Read ${missing} failed:`),
        }),
      )
      await expect(
        readFile(testFile, { flag: 'invalid' }),
      ).rejects.toMatchObject({
        code: 'ERR_INVALID_ARG_VALUE',
        message: expect.stringContaining(`Read ${testFile} failed:`),
      })
      expect(() => readFileSync(testFile, { flag: 'invalid' })).toThrow(
        expect.objectContaining({
          code: 'ERR_INVALID_ARG_VALUE',
          message: expect.stringContaining(`Read ${testFile} failed:`),
        }),
      )
    })
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
        throw new Error('应该抛出错误')
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
