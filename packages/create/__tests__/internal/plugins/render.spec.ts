import type { RenderTemplateOptions } from '@eljs/utils'
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

import renderPlugin from '../../../src/internal/plugins/render'
import type { CreatePluginContext } from '../../../src/types'

// Mock types
interface MockUtils {
  getCallerDirectory: MockedFunction<(depth: number) => string>
  isDirectory: MockedFunction<(path: string) => Promise<boolean>>
}

interface MockPath {
  basename: MockedFunction<(path: string) => string>
  join: MockedFunction<(...args: string[]) => string>
  resolve: MockedFunction<(...args: string[]) => string>
}

// Mock @eljs/utils
vi.mock('@eljs/utils/file', async () => import('@eljs/utils'))
vi.mock('@eljs/utils/path', async () => import('@eljs/utils'))
vi.mock('@eljs/utils', () => ({
  getCallerDirectory: vi.fn(() => '/base/dir'),
  isDirectory: vi.fn(),
}))

// Mock node:path
vi.mock('node:path', () => ({
  basename: vi.fn(
    (path: string) =>
      path
        .split('/')
        .pop()
        ?.replace(/\.tpl$/, '') || '',
  ),
  join: vi.fn((...args: string[]) => args.join('/')),
  resolve: vi.fn((...args: string[]) => args.join('/')),
}))

describe('内部插件 render', () => {
  let mockContext: Mocked<CreatePluginContext>
  let renderCallback: (
    path: string,
    data?: Record<string, unknown>,
    options?: RenderTemplateOptions,
  ) => Promise<void>
  let mockUtils: MockUtils
  let mockPath: MockPath

  beforeEach(() => {
    mockUtils = mockedUtils as unknown as MockUtils
    mockPath = mockedPath as unknown as MockPath

    mockContext = {
      registerCapability: vi.fn((name: string, fn: unknown) => {
        if (name === 'render') {
          renderCallback = fn as (
            path: string,
            data?: Record<string, unknown>,
            options?: RenderTemplateOptions,
          ) => Promise<void>
        }
      }),
      copyDirectory: vi.fn(),
      copyTpl: vi.fn(),
      copyFile: vi.fn(),
      paths: {
        target: '/test/project',
      },
    } as unknown as Mocked<CreatePluginContext>
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('应该是一个函数', () => {
    expect(typeof renderPlugin).toBe('function')
  })

  it('应该注册 render 方法', () => {
    renderPlugin(mockContext)

    expect(mockContext.registerCapability).toHaveBeenCalledTimes(1)
    expect(mockContext.registerCapability).toHaveBeenCalledWith(
      'render',
      expect.any(Function),
    )
  })

  describe('render 方法', () => {
    beforeEach(() => {
      renderPlugin(mockContext)
      vi.clearAllMocks()
    })

    it('应该处理目录渲染', async () => {
      mockUtils.getCallerDirectory.mockReturnValue('/caller/dir')
      mockUtils.isDirectory.mockResolvedValue(true)

      const data = { name: 'test' }
      const options: RenderTemplateOptions = { type: 'mustache' }

      await renderCallback('templates/src', data, options)

      expect(mockUtils.getCallerDirectory).toHaveBeenCalledWith(3)
      expect(mockPath.resolve).toHaveBeenCalledWith(
        '/caller/dir',
        'templates/src',
      )
      expect(mockUtils.isDirectory).toHaveBeenCalledWith(
        '/caller/dir/templates/src',
      )
      expect(mockContext.copyDirectory).toHaveBeenCalledWith(
        '/caller/dir/templates/src',
        '/test/project',
        data,
        {
          renderOptions: options,
        },
      )
    })

    it('应该处理模板文件渲染（.tpl）', async () => {
      mockUtils.getCallerDirectory.mockReturnValue('/caller/dir')
      mockUtils.isDirectory.mockResolvedValue(false)
      mockPath.basename.mockReturnValue('component.tsx')

      const data = { componentName: 'MyComponent' }
      const options: RenderTemplateOptions = {
        type: 'ejs',
        options: { cache: true },
      }

      await renderCallback('templates/component.tsx.tpl', data, options)

      expect(mockUtils.getCallerDirectory).toHaveBeenCalledWith(3)
      expect(mockPath.resolve).toHaveBeenCalledWith(
        '/caller/dir',
        'templates/component.tsx.tpl',
      )
      expect(mockUtils.isDirectory).toHaveBeenCalledWith(
        '/caller/dir/templates/component.tsx.tpl',
      )
      expect(mockPath.basename).toHaveBeenCalledWith(
        'templates/component.tsx.tpl',
      )
      expect(mockPath.join).toHaveBeenCalledWith(
        '/test/project',
        'component.tsx',
      )
      expect(mockContext.copyTpl).toHaveBeenCalledWith(
        '/caller/dir/templates/component.tsx.tpl',
        '/test/project/component.tsx',
        data,
        { renderOptions: options },
      )
    })

    it('应该处理常规文件渲染', async () => {
      mockUtils.getCallerDirectory.mockReturnValue('/caller/dir')
      mockUtils.isDirectory.mockResolvedValue(false)
      mockPath.basename.mockReturnValue('config.json')

      const data = { port: 3000 }
      const options: RenderTemplateOptions = { type: 'mustache', partials: {} }

      await renderCallback('templates/config.json', data, options)

      expect(mockUtils.getCallerDirectory).toHaveBeenCalledWith(3)
      expect(mockPath.resolve).toHaveBeenCalledWith(
        '/caller/dir',
        'templates/config.json',
      )
      expect(mockUtils.isDirectory).toHaveBeenCalledWith(
        '/caller/dir/templates/config.json',
      )
      expect(mockPath.basename).toHaveBeenCalledWith('templates/config.json')
      expect(mockPath.join).toHaveBeenCalledWith('/test/project', 'config.json')
      expect(mockContext.copyFile).toHaveBeenCalledWith(
        '/caller/dir/templates/config.json',
        '/test/project/config.json',
        {
          data,
          renderOptions: options,
        },
      )
    })

    it('应该处理默认空数据的渲染', async () => {
      mockUtils.getCallerDirectory.mockReturnValue('/caller/dir')
      mockUtils.isDirectory.mockResolvedValue(true)

      await renderCallback('templates/src')

      expect(mockContext.copyDirectory).toHaveBeenCalledWith(
        '/caller/dir/templates/src',
        '/test/project',
        {},
        {
          renderOptions: undefined,
        },
      )
    })

    it('应该处理默认空选项的渲染', async () => {
      mockUtils.getCallerDirectory.mockReturnValue('/caller/dir')
      mockUtils.isDirectory.mockResolvedValue(false)
      mockPath.basename.mockReturnValue('file.txt')

      await renderCallback('templates/file.txt', { name: 'test' })

      expect(mockContext.copyFile).toHaveBeenCalledWith(
        '/caller/dir/templates/file.txt',
        '/test/project/file.txt',
        {
          data: { name: 'test' },
          renderOptions: undefined,
        },
      )
    })

    it('应该为 .tpl 文件提取正确的 basename', async () => {
      mockUtils.getCallerDirectory.mockReturnValue('/caller/dir')
      mockUtils.isDirectory.mockResolvedValue(false)

      // Mock basename 模拟 .tpl 移除
      mockPath.basename.mockImplementation((path: string) => {
        const name = path.split('/').pop() || ''
        return name.replace(/\.tpl$/, '')
      })

      await renderCallback('templates/component.vue.tpl', {})

      expect(mockPath.basename).toHaveBeenCalledWith(
        'templates/component.vue.tpl',
      )
      expect(mockContext.copyTpl).toHaveBeenCalledWith(
        '/caller/dir/templates/component.vue.tpl',
        '/test/project/component.vue',
        {},
        { renderOptions: undefined },
      )
    })

    it('应该根据扩展名正确确定文件类型', async () => {
      mockUtils.getCallerDirectory.mockReturnValue('/caller/dir')
      mockUtils.isDirectory.mockResolvedValue(false)

      // 测试 .tpl 文件
      await renderCallback('template.txt.tpl', {})
      expect(mockContext.copyTpl).toHaveBeenCalled()
      expect(mockContext.copyFile).not.toHaveBeenCalled()

      vi.clearAllMocks()

      // 测试常规文件
      await renderCallback('config.json', {})
      expect(mockContext.copyFile).toHaveBeenCalled()
      expect(mockContext.copyTpl).not.toHaveBeenCalled()
    })

    it('应该正确处理复杂的文件路径', async () => {
      mockUtils.getCallerDirectory.mockReturnValue('/base/project')
      mockUtils.isDirectory.mockResolvedValue(false)
      mockPath.basename.mockReturnValue('deep-file.js')

      await renderCallback('src/components/deep-file.js', { test: true })

      expect(mockPath.resolve).toHaveBeenCalledWith(
        '/base/project',
        'src/components/deep-file.js',
      )
      expect(mockPath.join).toHaveBeenCalledWith(
        '/test/project',
        'deep-file.js',
      )
    })
  })

  it('注册 render 方法时不应该抛出异常', () => {
    expect(() => renderPlugin(mockContext)).not.toThrow()
  })
})
