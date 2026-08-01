import type { CopyFileOptions } from '@eljs/utils'
import * as mockedUtils from '@eljs/utils'
import * as mockedPath from 'node:path'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mocked,
  type MockedFunction,
} from 'vitest'

import generatorPlugin from '../../../src/internal/plugins/generator'
import type { CreatePluginContext } from '../../../src/types'

// Mock @eljs/utils
vi.mock('@eljs/utils/file', async () => import('@eljs/utils'))
vi.mock('@eljs/utils', () => ({
  copyDirectory: vi.fn(),
  copyFile: vi.fn(),
  copyTpl: vi.fn(),
}))

// Mock node:path
vi.mock('node:path', () => ({
  resolve: vi.fn((...args: string[]) => args.join('/')),
}))

// Mock types
interface MockUtils {
  copyDirectory: MockedFunction<
    (
      from: string,
      to: string,
      data: object,
      options: CopyFileOptions,
    ) => Promise<void>
  >
  copyFile: MockedFunction<
    (from: string, to: string, options: CopyFileOptions) => Promise<void>
  >
  copyTpl: MockedFunction<
    (
      from: string,
      to: string,
      data: object,
      options: CopyFileOptions,
    ) => Promise<void>
  >
}

interface MockPath {
  resolve: MockedFunction<(...args: string[]) => string>
}

describe('内部插件 generator', () => {
  let mockContext: Mocked<CreatePluginContext>
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
    mockUtils = mockedUtils as unknown as MockUtils
    mockPath = mockedPath as unknown as MockPath

    mockContext = {
      registerCapability: vi.fn((name: string, fn: unknown) => {
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
    } as unknown as Mocked<CreatePluginContext>
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('应该是一个函数', () => {
    expect(typeof generatorPlugin).toBe('function')
  })

  it('应该注册所有必需的方法', () => {
    generatorPlugin(mockContext)

    expect(mockContext.registerCapability).toHaveBeenCalledTimes(4)
    expect(mockContext.registerCapability).toHaveBeenCalledWith(
      'resolve',
      expect.any(Function),
    )
    expect(mockContext.registerCapability).toHaveBeenCalledWith(
      'copyFile',
      expect.any(Function),
    )
    expect(mockContext.registerCapability).toHaveBeenCalledWith(
      'copyTpl',
      expect.any(Function),
    )
    expect(mockContext.registerCapability).toHaveBeenCalledWith(
      'copyDirectory',
      expect.any(Function),
    )
  })

  describe('resolve 方法', () => {
    it('应该解析相对于目标目录的路径', () => {
      generatorPlugin(mockContext)

      const result = resolveCallback('src', 'index.ts')

      expect(mockPath.resolve).toHaveBeenCalledWith(
        '/test/project',
        'src',
        'index.ts',
      )
      expect(result).toBe('/test/project/src/index.ts')
    })

    it('应该处理单个路径', () => {
      generatorPlugin(mockContext)

      const result = resolveCallback('package.json')

      expect(mockPath.resolve).toHaveBeenCalledWith(
        '/test/project',
        'package.json',
      )
      expect(result).toBe('/test/project/package.json')
    })

    it('应该处理空路径', () => {
      generatorPlugin(mockContext)

      const result = resolveCallback()

      expect(mockPath.resolve).toHaveBeenCalledWith('/test/project')
      expect(result).toBe('/test/project')
    })
  })

  describe('copyFile 方法', () => {
    it('应该使用 basedir 选项调用 copyFile', async () => {
      generatorPlugin(mockContext)

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
      generatorPlugin(mockContext)

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
      generatorPlugin(mockContext)

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
      generatorPlugin(mockContext)

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
      generatorPlugin(mockContext)

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
      generatorPlugin(mockContext)

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
    expect(() => generatorPlugin(mockContext)).not.toThrow()
  })
})
