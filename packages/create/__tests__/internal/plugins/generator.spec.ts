import type { CopyFileOptions } from '@eljs/utils'

import generatorPlugin from '../../../src/internal/plugins/generator'
import type { Api } from '../../../src/types'

// Mock @eljs/utils
jest.mock('@eljs/utils', () => ({
  copyDirectory: jest.fn(),
  copyFile: jest.fn(),
  copyTpl: jest.fn(),
}))

// Mock node:path
jest.mock('node:path', () => ({
  resolve: jest.fn((...args: string[]) => args.join('/')),
}))

// Mock types
interface MockUtils {
  copyDirectory: jest.MockedFunction<
    (
      from: string,
      to: string,
      data: object,
      options: CopyFileOptions,
    ) => Promise<void>
  >
  copyFile: jest.MockedFunction<
    (from: string, to: string, options: CopyFileOptions) => Promise<void>
  >
  copyTpl: jest.MockedFunction<
    (
      from: string,
      to: string,
      data: object,
      options: CopyFileOptions,
    ) => Promise<void>
  >
}

interface MockPath {
  resolve: jest.MockedFunction<(...args: string[]) => string>
}

describe('内部插件 generator', () => {
  let mockApi: jest.Mocked<Api>
  let resolveCallback: (...paths: string[]) => string
  let copyFileCallback: (
    from: string,
    to: string,
    options: CopyFileOptions,
  ) => Promise<void>
  let copyTplCallback: (
    from: string,
    to: string,
    data: object,
    options: CopyFileOptions,
  ) => Promise<void>
  let copyDirectoryCallback: (
    from: string,
    to: string,
    data: object,
    options: CopyFileOptions,
  ) => Promise<void>
  let mockUtils: MockUtils
  let mockPath: MockPath

  beforeEach(() => {
    mockUtils = jest.requireMock('@eljs/utils') as MockUtils
    mockPath = jest.requireMock('node:path') as MockPath

    mockApi = {
      registerMethod: jest.fn((name: string, fn: unknown) => {
        if (name === 'resolve') {
          resolveCallback = fn as (...paths: string[]) => string
        } else if (name === 'copyFile') {
          copyFileCallback = fn as (
            from: string,
            to: string,
            options: CopyFileOptions,
          ) => Promise<void>
        } else if (name === 'copyTpl') {
          copyTplCallback = fn as (
            from: string,
            to: string,
            data: object,
            options: CopyFileOptions,
          ) => Promise<void>
        } else if (name === 'copyDirectory') {
          copyDirectoryCallback = fn as (
            from: string,
            to: string,
            data: object,
            options: CopyFileOptions,
          ) => Promise<void>
        }
      }),
      paths: {
        target: '/test/project',
      },
    } as unknown as jest.Mocked<Api>
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('应该是一个函数', () => {
    expect(typeof generatorPlugin).toBe('function')
  })

  it('应该注册所有必需的方法', () => {
    generatorPlugin(mockApi)

    expect(mockApi.registerMethod).toHaveBeenCalledTimes(4)
    expect(mockApi.registerMethod).toHaveBeenCalledWith(
      'resolve',
      expect.any(Function),
    )
    expect(mockApi.registerMethod).toHaveBeenCalledWith(
      'copyFile',
      expect.any(Function),
    )
    expect(mockApi.registerMethod).toHaveBeenCalledWith(
      'copyTpl',
      expect.any(Function),
    )
    expect(mockApi.registerMethod).toHaveBeenCalledWith(
      'copyDirectory',
      expect.any(Function),
    )
  })

  describe('resolve 方法', () => {
    it('应该解析相对于目标目录的路径', () => {
      generatorPlugin(mockApi)

      const result = resolveCallback('src', 'index.ts')

      expect(mockPath.resolve).toHaveBeenCalledWith(
        '/test/project',
        'src',
        'index.ts',
      )
      expect(result).toBe('/test/project/src/index.ts')
    })

    it('应该处理单个路径', () => {
      generatorPlugin(mockApi)

      const result = resolveCallback('package.json')

      expect(mockPath.resolve).toHaveBeenCalledWith(
        '/test/project',
        'package.json',
      )
      expect(result).toBe('/test/project/package.json')
    })

    it('应该处理空路径', () => {
      generatorPlugin(mockApi)

      const result = resolveCallback()

      expect(mockPath.resolve).toHaveBeenCalledWith('/test/project')
      expect(result).toBe('/test/project')
    })
  })

  describe('copyFile 方法', () => {
    it('应该使用 basedir 选项调用 copyFile', async () => {
      generatorPlugin(mockApi)

      const options: CopyFileOptions = { mode: 0o755, basedir: '/custom' }
      await copyFileCallback('source.txt', 'dest.txt', options)

      expect(mockUtils.copyFile).toHaveBeenCalledWith(
        'source.txt',
        'dest.txt',
        {
          mode: 0o755,
          basedir: '/test/project',
        },
      )
    })

    it('应该处理空选项', async () => {
      generatorPlugin(mockApi)

      await copyFileCallback('source.txt', 'dest.txt', {})

      expect(mockUtils.copyFile).toHaveBeenCalledWith(
        'source.txt',
        'dest.txt',
        {
          basedir: '/test/project',
        },
      )
    })
  })

  describe('copyTpl 方法', () => {
    it('应该使用 basedir 选项调用 copyTpl', async () => {
      generatorPlugin(mockApi)

      const data = { name: 'test' }
      const options: CopyFileOptions = {
        data: { template: 'data' },
        renderOptions: { type: 'ejs', options: { cache: true } },
      }
      await copyTplCallback('template.txt', 'output.txt', data, options)

      expect(mockUtils.copyTpl).toHaveBeenCalledWith(
        'template.txt',
        'output.txt',
        data,
        {
          data: { template: 'data' },
          renderOptions: { type: 'ejs', options: { cache: true } },
          basedir: '/test/project',
        },
      )
    })

    it('应该处理空数据和选项', async () => {
      generatorPlugin(mockApi)

      await copyTplCallback('template.txt', 'output.txt', {}, {})

      expect(mockUtils.copyTpl).toHaveBeenCalledWith(
        'template.txt',
        'output.txt',
        {},
        {
          basedir: '/test/project',
        },
      )
    })
  })

  describe('copyDirectory 方法', () => {
    it('应该使用 basedir 选项调用 copyDirectory', async () => {
      generatorPlugin(mockApi)

      const data = { version: '1.0.0' }
      const options: CopyFileOptions = {
        mode: 0o755,
        data: { template: 'data' },
      }
      await copyDirectoryCallback('src', 'dest', data, options)

      expect(mockUtils.copyDirectory).toHaveBeenCalledWith(
        'src',
        'dest',
        data,
        {
          mode: 0o755,
          data: { template: 'data' },
          basedir: '/test/project',
        },
      )
    })

    it('应该处理空数据和选项', async () => {
      generatorPlugin(mockApi)

      await copyDirectoryCallback('src', 'dest', {}, {})

      expect(mockUtils.copyDirectory).toHaveBeenCalledWith(
        'src',
        'dest',
        {},
        {
          basedir: '/test/project',
        },
      )
    })
  })

  it('注册方法时不应该抛出异常', () => {
    expect(() => generatorPlugin(mockApi)).not.toThrow()
  })
})
