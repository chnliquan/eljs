/* eslint-disable @typescript-eslint/no-var-requires */
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  fileLoaders,
  fileLoadersSync,
  loadJson,
  loadJsonSync,
  loadJsSync,
  loadTs,
  loadTsSync,
  loadYaml,
  loadYamlSync,
  resolveTsConfig,
} from '../../src/file/loader'

// Mock 依赖项
jest.mock('parse-json')
jest.mock('js-yaml')
jest.mock('typescript', () => ({
  ModuleKind: { NodeNext: 199 },
  ModuleResolutionKind: { NodeNext: 3 },
  ScriptTarget: { ES2022: 9 },
  transpileModule: jest.fn(),
  findConfigFile: jest.fn(),
  readConfigFile: jest.fn(),
  sys: {
    fileExists: jest.fn(),
    readFile: jest.fn(),
  },
}))
jest.mock('import-fresh')
jest.mock('../../src/file/read')
jest.mock('../../src/file/write')
jest.mock('../../src/file/remove')
jest.mock('../../src/file/is')

describe('文件加载器工具 - 完整测试', () => {
  const mockParseJson = require('parse-json') as jest.MockedFunction<
    (
      input: string | null,
      reviver?: (key: string, value: unknown) => unknown,
      filepath?: string,
    ) => unknown
  >
  const mockYaml = require('js-yaml') as {
    load: jest.MockedFunction<(text: string) => unknown>
  }

  // TypeScript 模块的类型定义
  interface MockTypeScriptModule {
    ModuleKind: { NodeNext: number }
    ModuleResolutionKind: { NodeNext: number }
    ScriptTarget: { ES2022: number }
    transpileModule: jest.MockedFunction<
      (
        input: string,
        transpileOptions: unknown,
      ) => { outputText: string; diagnostics?: unknown[] }
    >
    findConfigFile: jest.MockedFunction<
      (
        searchPath: string,
        fileExists: (fileName: string) => boolean,
      ) => string | undefined
    >
    readConfigFile: jest.MockedFunction<
      (
        fileName: string,
        readFile: (path: string) => string | undefined,
      ) => {
        config: unknown
        error?: { messageText: { toString(): string } } | null
      }
    >
    sys: {
      fileExists: jest.MockedFunction<(fileName: string) => boolean>
      readFile: jest.MockedFunction<(path: string) => string | undefined>
    }
  }

  const mockTypeScript = require('typescript') as MockTypeScriptModule
  const mockImportFresh = require('import-fresh') as jest.MockedFunction<
    (filePath: string) => unknown
  >
  const mockReadFile = require('../../src/file/read')
    .readFile as jest.MockedFunction<(filePath: string) => Promise<string>>
  const mockReadFileSync = require('../../src/file/read')
    .readFileSync as jest.MockedFunction<(filePath: string) => string>
  const mockWriteFileSync = require('../../src/file/write')
    .writeFileSync as jest.MockedFunction<
    (filePath: string, content: string) => void
  >
  const mockRemoveSync = require('../../src/file/remove')
    .removeSync as jest.MockedFunction<(filePath: string) => void>
  const mockIsPathExistsSync = require('../../src/file/is')
    .isPathExistsSync as jest.MockedFunction<(filePath: string) => boolean>

  let tempDir: string

  beforeEach(async () => {
    jest.clearAllMocks()
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'loader-test-'))
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    try {
      await fsp.rm(tempDir, { recursive: true, force: true })
    } catch {
      // 忽略清理错误
    }
  })

  describe('loadJson 功能', () => {
    it('应该异步加载JSON文件', async () => {
      const jsonContent = '{"name": "test", "version": "1.0.0"}'
      const expectedData = { name: 'test', version: '1.0.0' }

      mockReadFile.mockResolvedValue(jsonContent)
      mockParseJson.mockReturnValue(expectedData)

      const result = await loadJson(path.join(tempDir, 'test.json'))

      expect(mockReadFile).toHaveBeenCalled()
      expect(mockParseJson).toHaveBeenCalledWith(jsonContent)
      expect(result).toEqual(expectedData)
    })

    it('应该同步加载JSON文件', () => {
      const jsonContent = '{"sync": true}'
      const expectedData = { sync: true }

      mockReadFileSync.mockReturnValue(jsonContent)
      mockParseJson.mockReturnValue(expectedData)

      const result = loadJsonSync(path.join(tempDir, 'test.json'))

      expect(mockReadFileSync).toHaveBeenCalled()
      expect(mockParseJson).toHaveBeenCalledWith(jsonContent)
      expect(result).toEqual(expectedData)
    })

    it('应该处理复杂的JSON数据', async () => {
      interface ComplexData {
        config: {
          database: { host: string; port: number }
          features: string[]
        }
        metadata: { version: string; author: string }
      }

      const complexData: ComplexData = {
        config: {
          database: { host: 'localhost', port: 5432 },
          features: ['auth', 'logging'],
        },
        metadata: { version: '2.0.0', author: 'Developer' },
      }

      mockReadFile.mockResolvedValue(JSON.stringify(complexData))
      mockParseJson.mockReturnValue(complexData)

      const result = await loadJson<ComplexData>('/complex.json')

      expect(result.config.database.host).toBe('localhost')
      expect(result.config.features).toContain('auth')
      expect(result.metadata.version).toBe('2.0.0')
    })

    it('应该在JSON解析失败时抛出错误', async () => {
      mockReadFile.mockResolvedValue('invalid json')
      mockParseJson.mockImplementation(() => {
        throw new Error('JSON parse error')
      })

      await expect(loadJson('/test.json')).rejects.toThrow(/Parse .* failed/)
    })

    it('应该在第二次调用时重用 parse-json', async () => {
      const content1 = '{ "first": true }'
      const content2 = '{ "second": true }'

      mockReadFile
        .mockResolvedValueOnce(content1)
        .mockResolvedValueOnce(content2)
      mockParseJson
        .mockReturnValueOnce({ first: true })
        .mockReturnValueOnce({ second: true })

      const result1 = await loadJson('/test1.json')
      const result2 = await loadJson('/test2.json')

      expect(result1).toEqual({ first: true })
      expect(result2).toEqual({ second: true })
    })
  })

  describe('loadYaml 功能', () => {
    it('应该异步加载YAML文件', async () => {
      const yamlContent = 'name: test\nversion: 1.0.0'
      const expectedData = { name: 'test', version: '1.0.0' }

      mockReadFile.mockResolvedValue(yamlContent)
      mockYaml.load.mockReturnValue(expectedData)

      const result = await loadYaml(path.join(tempDir, 'test.yaml'))

      expect(mockReadFile).toHaveBeenCalled()
      expect(mockYaml.load).toHaveBeenCalledWith(yamlContent)
      expect(result).toEqual(expectedData)
    })

    it('应该同步加载YAML文件', () => {
      const yamlContent = 'sync: true'
      const expectedData = { sync: true }

      mockReadFileSync.mockReturnValue(yamlContent)
      mockYaml.load.mockReturnValue(expectedData)

      const result = loadYamlSync(path.join(tempDir, 'test.yaml'))

      expect(mockReadFileSync).toHaveBeenCalled()
      expect(mockYaml.load).toHaveBeenCalledWith(yamlContent)
      expect(result).toEqual(expectedData)
    })

    it('应该处理复杂的YAML结构', async () => {
      interface YamlConfig {
        server: { port: number; host: string }
        database: { url: string; ssl: boolean }
        features: string[]
      }

      const yamlData: YamlConfig = {
        server: { port: 3000, host: 'localhost' },
        database: { url: 'mongodb://localhost', ssl: false },
        features: ['websockets', 'graphql'],
      }

      mockReadFile.mockResolvedValue('server:\n  port: 3000\n  host: localhost')
      mockYaml.load.mockReturnValue(yamlData)

      const result = await loadYaml<YamlConfig>('/config.yml')

      expect(result.server.port).toBe(3000)
      expect(result.features).toContain('websockets')
    })

    it('应该在YAML解析失败时抛出错误', async () => {
      mockReadFile.mockResolvedValue('invalid: yaml: [structure')
      mockYaml.load.mockImplementation(() => {
        throw new Error('YAML syntax error')
      })

      await expect(loadYaml('/test.yaml')).rejects.toThrow(/Load .* failed/)
    })

    it('应该在第二次调用时重用 js-yaml', () => {
      const content1 = 'name: first'
      const content2 = 'name: second'

      mockReadFileSync
        .mockReturnValueOnce(content1)
        .mockReturnValueOnce(content2)
      mockYaml.load
        .mockReturnValueOnce({ name: 'first' })
        .mockReturnValueOnce({ name: 'second' })

      const result1 = loadYamlSync('/test1.yaml')
      const result2 = loadYamlSync('/test2.yaml')

      expect(result1).toEqual({ name: 'first' })
      expect(result2).toEqual({ name: 'second' })
    })
  })

  describe('JavaScript 文件同步加载', () => {
    it('应该同步加载 JS 文件', () => {
      const mockContent = { sync: true }
      mockImportFresh.mockReturnValue(mockContent)

      const result = loadJsSync('/test.js')

      expect(mockImportFresh).toHaveBeenCalledWith('/test.js')
      expect(result).toEqual(mockContent)
    })

    it('应该在同步加载失败时抛出增强的错误', () => {
      mockImportFresh.mockImplementation(() => {
        throw new Error('Sync load failed')
      })

      expect(() => loadJsSync('/test.js')).toThrow(
        'Load /test.js failed: Sync load failed',
      )
    })

    it('应该在第二次调用时重用 importFresh', () => {
      const mockContent1 = { first: true }
      const mockContent2 = { second: true }

      mockImportFresh.mockReturnValueOnce(mockContent1)
      mockImportFresh.mockReturnValueOnce(mockContent2)

      const result1 = loadJsSync('/test1.js')
      const result2 = loadJsSync('/test2.js')

      expect(result1).toEqual(mockContent1)
      expect(result2).toEqual(mockContent2)
      expect(mockImportFresh).toHaveBeenCalledTimes(2)
    })

    it('应该延迟加载 import-fresh 模块', () => {
      const mockContent = { importFresh: true }
      mockImportFresh.mockReturnValue(mockContent)

      loadJsSync('/test.js')

      expect(mockImportFresh).toHaveBeenCalledWith('/test.js')
    })
  })

  describe('TypeScript 文件加载', () => {
    it('应该异步编译和加载 TS 文件', async () => {
      const mockTsContent = 'const test: string = "hello"; export default test'
      const mockCompiledContent = 'const test = "hello"; module.exports = test;'
      const mockResult = { default: 'hello' }

      mockReadFile.mockResolvedValue(mockTsContent)
      mockTypeScript.transpileModule.mockReturnValue({
        outputText: mockCompiledContent,
        diagnostics: [],
      })
      mockImportFresh.mockReturnValue(mockResult)

      const result = await loadTs('/test.ts')

      expect(mockReadFile).toHaveBeenCalledWith('/test.ts')
      expect(mockTypeScript.transpileModule).toHaveBeenCalledWith(
        mockTsContent,
        expect.objectContaining({
          compilerOptions: expect.objectContaining({
            module: 199, // typescript.ModuleKind.NodeNext
            target: 9, // typescript.ScriptTarget.ES2022
          }),
        }),
      )
      expect(result).toEqual(mockResult)
    })

    it('应该处理异步 TypeScript 编译错误', async () => {
      const mockTsContent = 'invalid typescript code'

      mockReadFile.mockResolvedValue(mockTsContent)
      mockTypeScript.transpileModule.mockImplementation(() => {
        throw new Error('TypeScript compilation failed')
      })

      await expect(loadTs('/test.ts')).rejects.toThrow(
        'TypeScript Error in /test.ts: TypeScript compilation failed',
      )
    })

    it('应该同步编译和加载 TS 文件', () => {
      const mockTsContent = 'const test: string = "hello"; export default test'
      const mockCompiledContent = 'const test = "hello"; module.exports = test;'
      const mockResult = { default: 'hello' }

      mockReadFileSync.mockReturnValue(mockTsContent)
      mockTypeScript.transpileModule.mockReturnValue({
        outputText: mockCompiledContent,
        diagnostics: [],
      })
      mockImportFresh.mockReturnValue(mockResult)
      mockIsPathExistsSync.mockReturnValue(true) // 模拟文件存在，需要清理

      const result = loadTsSync('/test.ts')

      expect(mockReadFileSync).toHaveBeenCalledWith('/test.ts')
      expect(mockTypeScript.transpileModule).toHaveBeenCalledWith(
        mockTsContent,
        expect.objectContaining({
          compilerOptions: expect.objectContaining({
            module: 199, // typescript.ModuleKind.NodeNext
            target: 9, // typescript.ScriptTarget.ES2022
          }),
        }),
      )
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/test.cjs',
        mockCompiledContent,
      )
      expect(mockRemoveSync).toHaveBeenCalledWith('/test.cjs')
      expect(result).toEqual(mockResult)
    })

    it('应该处理 TypeScript 编译错误', () => {
      const mockTsContent = 'invalid typescript code'

      mockReadFileSync.mockReturnValue(mockTsContent)
      mockTypeScript.transpileModule.mockImplementation(() => {
        throw new Error('TypeScript compilation failed')
      })

      expect(() => loadTsSync('/test.ts')).toThrow(
        'TypeScript Error in /test.ts: TypeScript compilation failed',
      )
    })

    it('应该延迟加载 typescript 模块', () => {
      const mockResult = { lazy: 'typescript' }

      mockReadFileSync.mockReturnValue('export default "test"')
      mockTypeScript.transpileModule.mockReturnValue({
        outputText: 'module.exports = "test"',
      })
      mockImportFresh.mockReturnValue(mockResult)

      loadTsSync('/test.ts')

      // typescript 模块应该被加载
      expect(mockTypeScript.transpileModule).toHaveBeenCalled()
    })

    it('应该正确处理编译后的文件路径', () => {
      const mockTsContent = 'export const test = "hello"'
      const mockCompiledContent = 'exports.test = "hello";'

      mockReadFileSync.mockReturnValue(mockTsContent)
      mockTypeScript.transpileModule.mockReturnValue({
        outputText: mockCompiledContent,
      })
      mockImportFresh.mockReturnValue({ test: 'hello' })

      loadTsSync('/path/to/file.ts')

      expect(mockImportFresh).toHaveBeenCalledWith('/path/to/file.cjs')
    })
  })

  describe('TypeScript 配置解析', () => {
    // 在测试 resolveTsConfig 前，先确保 TypeScript 模块已初始化
    beforeEach(() => {
      // 通过调用 loadTsSync 来初始化 typescript 模块，但不让它执行完整流程
      mockReadFileSync.mockReturnValue('export const init = true')
      mockTypeScript.transpileModule.mockReturnValue({
        outputText: 'exports.init = true',
      })
      mockImportFresh.mockReturnValue({ init: true })

      try {
        loadTsSync('/init.ts') // 这会初始化 typescript 变量
      } catch (e) {
        // 忽略任何错误，我们只是想初始化模块
      }

      // 重置所有 mocks，准备真正的测试
      jest.clearAllMocks()
    })

    describe('resolveTsConfig', () => {
      it('应该解析存在的 tsconfig 文件', () => {
        const mockConfig = {
          compilerOptions: {
            target: 'ES2020',
            module: 'commonjs',
          },
        }

        mockTypeScript.findConfigFile.mockReturnValue('/project/tsconfig.json')
        mockTypeScript.readConfigFile.mockReturnValue({
          config: mockConfig,
          error: null,
        })

        const result = resolveTsConfig('/project/src')

        expect(mockTypeScript.findConfigFile).toHaveBeenCalledWith(
          '/project/src',
          expect.any(Function),
        )
        expect(result).toEqual(mockConfig)
      })

      it('应该在没有 tsconfig 文件时返回空配置', () => {
        mockTypeScript.findConfigFile.mockReturnValue(undefined)

        const result = resolveTsConfig('/project/src')

        expect(result).toEqual({})
      })

      it('应该处理 tsconfig 读取错误', () => {
        const configError = {
          messageText: { toString: () => 'Config parse error' },
        }

        mockTypeScript.findConfigFile.mockReturnValue('/project/tsconfig.json')
        mockTypeScript.readConfigFile.mockReturnValue({
          config: null,
          error: configError,
        })

        expect(() => resolveTsConfig('/project/src')).toThrow(
          'Resolve file /project/tsconfig.json failed: Config parse error',
        )
      })

      it('应该正确使用文件系统检查函数', () => {
        const mockFileExists = jest.fn().mockReturnValue(true)
        mockTypeScript.sys.fileExists = mockFileExists
        mockTypeScript.findConfigFile.mockImplementation(
          (dir: string, fileExists: (fileName: string) => boolean) => {
            // 模拟调用传入的 fileExists 函数
            fileExists('/project/tsconfig.json')
            return '/project/tsconfig.json'
          },
        )
        mockTypeScript.readConfigFile.mockReturnValue({
          config: {},
          error: null,
        })

        resolveTsConfig('/project/src')

        expect(mockFileExists).toHaveBeenCalledWith('/project/tsconfig.json')
      })

      it('应该验证延迟加载 typescript 模块', () => {
        // 测试 typescript 模块的懒加载
        mockTypeScript.findConfigFile.mockReturnValue(undefined)

        resolveTsConfig('/test')

        expect(mockTypeScript.findConfigFile).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('文件加载器常量', () => {
    it('应该包含正确的异步加载器', () => {
      expect(Object.keys(fileLoaders)).toContain('.json')
      expect(Object.keys(fileLoaders)).toContain('.yaml')
      expect(Object.keys(fileLoaders)).toContain('.yml')
      expect(Object.keys(fileLoaders)).toContain('.js')
      expect(Object.keys(fileLoaders)).toContain('.mjs')
      expect(Object.keys(fileLoaders)).toContain('.cjs')
      expect(Object.keys(fileLoaders)).toContain('.ts')
    })

    it('应该包含正确的同步加载器', () => {
      expect(Object.keys(fileLoadersSync)).toContain('.json')
      expect(Object.keys(fileLoadersSync)).toContain('.yaml')
      expect(Object.keys(fileLoadersSync)).toContain('.yml')
      expect(Object.keys(fileLoadersSync)).toContain('.js')
      expect(Object.keys(fileLoadersSync)).toContain('.cjs')
      expect(Object.keys(fileLoadersSync)).toContain('.ts')
      // 注意：同步加载器不包含 .mjs
      expect(Object.keys(fileLoadersSync)).not.toContain('.mjs')
    })

    it('应该确保加载器对象是不可变的', () => {
      expect(Object.isFrozen(fileLoaders)).toBe(true)
      expect(Object.isFrozen(fileLoadersSync)).toBe(true)

      // 尝试修改应该被阻止
      expect(() => {
        ;(fileLoaders as Record<string, unknown>)['.new'] = () => {}
      }).toThrow()
    })

    it('应该验证加载器函数类型', () => {
      Object.values(fileLoaders).forEach(loader => {
        expect(typeof loader).toBe('function')
      })

      Object.values(fileLoadersSync).forEach(loader => {
        expect(typeof loader).toBe('function')
      })
    })

    it('应该验证加载器映射正确性', () => {
      // 验证文件扩展名到加载器的映射
      expect(fileLoaders['.json']).toBe(loadJson)
      expect(fileLoaders['.yaml']).toBe(loadYaml)
      expect(fileLoaders['.yml']).toBe(loadYaml)

      expect(fileLoadersSync['.json']).toBe(loadJsonSync)
      expect(fileLoadersSync['.yaml']).toBe(loadYamlSync)
      expect(fileLoadersSync['.yml']).toBe(loadYamlSync)
    })
  })

  describe('错误处理和边界情况', () => {
    it('应该处理文件读取失败', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'))

      await expect(loadJson('/nonexistent.json')).rejects.toThrow(
        'File not found',
      )
    })

    it('应该处理同步文件读取失败', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Sync file not found')
      })

      expect(() => loadJsonSync('/nonexistent.json')).toThrow(
        'Sync file not found',
      )
    })

    it('应该处理空文件内容', async () => {
      mockReadFile.mockResolvedValue('')
      mockParseJson.mockReturnValue({})

      const result = await loadJson('/empty.json')

      expect(result).toEqual({})
    })

    it('应该处理特殊字符的文件内容', async () => {
      const specialContent =
        '{"emoji": "🎉", "chinese": "测试", "symbols": "@#$%"}'
      const expectedData = { emoji: '🎉', chinese: '测试', symbols: '@#$%' }

      mockReadFile.mockResolvedValue(specialContent)
      mockParseJson.mockReturnValue(expectedData)

      const result = await loadJson('/special.json')

      expect(result).toEqual(expectedData)
    })

    it('应该处理非常长的文件路径', async () => {
      const longPath = '/very/long/path/'.repeat(50) + 'file.json'
      const content = '{ "test": true }'

      mockReadFile.mockResolvedValue(content)
      mockParseJson.mockReturnValue({ test: true })

      const result = await loadJson(longPath)

      expect(result).toEqual({ test: true })
      expect(mockReadFile).toHaveBeenCalledWith(longPath)
    })

    it('应该处理包含特殊字符的路径', async () => {
      const specialPath = '/path/with spaces/файл-test-文件.json'
      const content = '{ "special": true }'

      mockReadFile.mockResolvedValue(content)
      mockParseJson.mockReturnValue({ special: true })

      const result = await loadJson(specialPath)

      expect(result).toEqual({ special: true })
    })

    it('应该处理空文件路径错误', async () => {
      mockReadFile.mockRejectedValue(new Error('Empty path'))

      await expect(loadJson('')).rejects.toThrow('Empty path')
    })

    it('应该处理权限拒绝错误', async () => {
      const permissionError = new Error(
        'EACCES: permission denied',
      ) as NodeJS.ErrnoException
      permissionError.code = 'EACCES'

      mockReadFile.mockRejectedValue(permissionError)

      await expect(loadJson('/permission-denied.json')).rejects.toThrow(
        'EACCES: permission denied',
      )
    })
  })

  describe('JSON 错误处理增强', () => {
    it('应该处理 parse-json 的增强错误信息', async () => {
      mockReadFile.mockResolvedValue('invalid json')
      mockParseJson.mockImplementation(() => {
        const error = new Error('Unexpected token')
        error.name = 'JSONError'
        throw error
      })

      await expect(loadJson('/test.json')).rejects.toThrow(
        'Parse /test.json failed: Unexpected token',
      )
    })

    it('应该处理同步 JSON 解析错误', () => {
      mockReadFileSync.mockReturnValue('{ invalid json')
      mockParseJson.mockImplementation(() => {
        throw new SyntaxError('Unexpected end of JSON input')
      })

      expect(() => loadJsonSync('/test.json')).toThrow(
        'Parse /test.json failed: Unexpected end of JSON input',
      )
    })
  })

  describe('YAML 错误处理增强', () => {
    it('应该处理 js-yaml 的特定错误', async () => {
      mockReadFile.mockResolvedValue('invalid: yaml: [')
      mockYaml.load.mockImplementation(() => {
        const error = new Error('YAMLException: unexpected end of the stream')
        error.name = 'YAMLException'
        throw error
      })

      await expect(loadYaml('/test.yaml')).rejects.toThrow(
        'Load /test.yaml failed: YAMLException: unexpected end of the stream',
      )
    })

    it('应该处理同步 YAML 解析错误', () => {
      mockReadFileSync.mockReturnValue('invalid: [yaml]')
      mockYaml.load.mockImplementation(() => {
        throw new Error('bad indentation of a mapping entry')
      })

      expect(() => loadYamlSync('/test.yaml')).toThrow(
        'Load /test.yaml failed: bad indentation of a mapping entry',
      )
    })
  })

  describe('类型安全验证', () => {
    it('应该保持泛型类型', async () => {
      interface TypedConfig {
        appName: string
        version: string
        features: {
          auth: boolean
          api: boolean
        }
        dependencies: string[]
      }

      const typedData: TypedConfig = {
        appName: 'TypedApp',
        version: '1.0.0',
        features: { auth: true, api: false },
        dependencies: ['react', 'typescript'],
      }

      mockReadFile.mockResolvedValue(JSON.stringify(typedData))
      mockParseJson.mockReturnValue(typedData)

      const result = await loadJson<TypedConfig>('/typed.json')

      // TypeScript 应该知道这些属性的类型
      expect(typeof result.appName).toBe('string')
      expect(typeof result.features.auth).toBe('boolean')
      expect(Array.isArray(result.dependencies)).toBe(true)
    })

    it('应该支持 YAML 的类型推断', async () => {
      interface ServerConfig {
        port: number
        host: string
        ssl: boolean
      }

      const serverConfig: ServerConfig = {
        port: 8080,
        host: 'example.com',
        ssl: true,
      }

      mockReadFile.mockResolvedValue('port: 8080\nhost: example.com\nssl: true')
      mockYaml.load.mockReturnValue(serverConfig)

      const result = await loadYaml<ServerConfig>('/server.yml')

      expect(typeof result.port).toBe('number')
      expect(typeof result.host).toBe('string')
      expect(typeof result.ssl).toBe('boolean')
    })
  })

  describe('模块懒加载行为', () => {
    it('应该测试模块懒加载模式', async () => {
      // 验证模块只在需要时加载
      mockReadFile.mockResolvedValue('{"lazy": "load"}')
      mockParseJson.mockReturnValue({ lazy: 'load' })

      await loadJson('/lazy.json')

      // parse-json 应该被调用
      expect(mockParseJson).toHaveBeenCalledTimes(1)
    })

    it('应该验证模块重用', async () => {
      // 第一次调用
      mockReadFile.mockResolvedValueOnce('{"first": true}')
      mockParseJson.mockReturnValueOnce({ first: true })

      // 第二次调用
      mockReadFile.mockResolvedValueOnce('{"second": true}')
      mockParseJson.mockReturnValueOnce({ second: true })

      await loadJson('/first.json')
      await loadJson('/second.json')

      // 模块应该被重用，不是重新加载
      expect(mockParseJson).toHaveBeenCalledTimes(2)
    })
  })
})
