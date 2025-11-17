import type { RenderTemplateOptions } from '@eljs/utils'

import renderPlugin from '../../../src/internal/plugins/render'
import type { Api } from '../../../src/types'

// Mock types
interface MockUtils {
  extractCallDir: jest.MockedFunction<(depth: number) => string>
  isDirectory: jest.MockedFunction<(path: string) => Promise<boolean>>
}

interface MockPath {
  basename: jest.MockedFunction<(path: string) => string>
  join: jest.MockedFunction<(...args: string[]) => string>
  resolve: jest.MockedFunction<(...args: string[]) => string>
}

// Mock @eljs/utils
jest.mock('@eljs/utils', () => ({
  extractCallDir: jest.fn(() => '/base/dir'),
  isDirectory: jest.fn(),
}))

// Mock node:path
jest.mock('node:path', () => ({
  basename: jest.fn(
    (path: string) =>
      path
        .split('/')
        .pop()
        ?.replace(/\.tpl$/, '') || '',
  ),
  join: jest.fn((...args: string[]) => args.join('/')),
  resolve: jest.fn((...args: string[]) => args.join('/')),
}))

describe('内部插件 render', () => {
  let mockApi: jest.Mocked<Api>
  let renderCallback: (
    path: string,
    data?: Record<string, unknown>,
    options?: RenderTemplateOptions,
  ) => Promise<void>
  let mockUtils: MockUtils
  let mockPath: MockPath

  beforeEach(() => {
    mockUtils = jest.requireMock('@eljs/utils') as MockUtils
    mockPath = jest.requireMock('node:path') as MockPath

    mockApi = {
      registerMethod: jest.fn((name: string, fn: unknown) => {
        if (name === 'render') {
          renderCallback = fn as (
            path: string,
            data?: Record<string, unknown>,
            options?: RenderTemplateOptions,
          ) => Promise<void>
        }
      }),
      copyDirectory: jest.fn(),
      copyTpl: jest.fn(),
      copyFile: jest.fn(),
      paths: {
        target: '/test/project',
      },
    } as unknown as jest.Mocked<Api>
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('应该是一个函数', () => {
    expect(typeof renderPlugin).toBe('function')
  })

  it('应该注册 render 方法', () => {
    renderPlugin(mockApi)

    expect(mockApi.registerMethod).toHaveBeenCalledTimes(1)
    expect(mockApi.registerMethod).toHaveBeenCalledWith(
      'render',
      expect.any(Function),
    )
  })

  describe('render 方法', () => {
    beforeEach(() => {
      renderPlugin(mockApi)
      jest.clearAllMocks()
    })

    it('应该处理目录渲染', async () => {
      mockUtils.extractCallDir.mockReturnValue('/caller/dir')
      mockUtils.isDirectory.mockResolvedValue(true)

      const data = { name: 'test' }
      const options: RenderTemplateOptions = { type: 'mustache' }

      await renderCallback('templates/src', data, options)

      expect(mockUtils.extractCallDir).toHaveBeenCalledWith(3)
      expect(mockPath.resolve).toHaveBeenCalledWith(
        '/caller/dir',
        'templates/src',
      )
      expect(mockUtils.isDirectory).toHaveBeenCalledWith(
        '/caller/dir/templates/src',
      )
      expect(mockApi.copyDirectory).toHaveBeenCalledWith(
        '/caller/dir/templates/src',
        '/test/project',
        data,
        {
          renderOptions: options,
        },
      )
    })

    it('应该处理模板文件渲染（.tpl）', async () => {
      mockUtils.extractCallDir.mockReturnValue('/caller/dir')
      mockUtils.isDirectory.mockResolvedValue(false)
      mockPath.basename.mockReturnValue('component.tsx')

      const data = { componentName: 'MyComponent' }
      const options: RenderTemplateOptions = {
        type: 'ejs',
        options: { cache: true },
      }

      await renderCallback('templates/component.tsx.tpl', data, options)

      expect(mockUtils.extractCallDir).toHaveBeenCalledWith(3)
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
      expect(mockApi.copyTpl).toHaveBeenCalledWith(
        '/caller/dir/templates/component.tsx.tpl',
        '/test/project/component.tsx',
        data,
        { renderOptions: options },
      )
    })

    it('应该处理常规文件渲染', async () => {
      mockUtils.extractCallDir.mockReturnValue('/caller/dir')
      mockUtils.isDirectory.mockResolvedValue(false)
      mockPath.basename.mockReturnValue('config.json')

      const data = { port: 3000 }
      const options: RenderTemplateOptions = { type: 'mustache', partials: {} }

      await renderCallback('templates/config.json', data, options)

      expect(mockUtils.extractCallDir).toHaveBeenCalledWith(3)
      expect(mockPath.resolve).toHaveBeenCalledWith(
        '/caller/dir',
        'templates/config.json',
      )
      expect(mockUtils.isDirectory).toHaveBeenCalledWith(
        '/caller/dir/templates/config.json',
      )
      expect(mockPath.basename).toHaveBeenCalledWith('templates/config.json')
      expect(mockPath.join).toHaveBeenCalledWith('/test/project', 'config.json')
      expect(mockApi.copyFile).toHaveBeenCalledWith(
        '/caller/dir/templates/config.json',
        '/test/project/config.json',
        {
          data,
          renderOptions: options,
        },
      )
    })

    it('应该处理默认空数据的渲染', async () => {
      mockUtils.extractCallDir.mockReturnValue('/caller/dir')
      mockUtils.isDirectory.mockResolvedValue(true)

      await renderCallback('templates/src')

      expect(mockApi.copyDirectory).toHaveBeenCalledWith(
        '/caller/dir/templates/src',
        '/test/project',
        {},
        {
          renderOptions: undefined,
        },
      )
    })

    it('应该处理默认空选项的渲染', async () => {
      mockUtils.extractCallDir.mockReturnValue('/caller/dir')
      mockUtils.isDirectory.mockResolvedValue(false)
      mockPath.basename.mockReturnValue('file.txt')

      await renderCallback('templates/file.txt', { name: 'test' })

      expect(mockApi.copyFile).toHaveBeenCalledWith(
        '/caller/dir/templates/file.txt',
        '/test/project/file.txt',
        {
          data: { name: 'test' },
          renderOptions: undefined,
        },
      )
    })

    it('应该为 .tpl 文件提取正确的 basename', async () => {
      mockUtils.extractCallDir.mockReturnValue('/caller/dir')
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
      expect(mockApi.copyTpl).toHaveBeenCalledWith(
        '/caller/dir/templates/component.vue.tpl',
        '/test/project/component.vue',
        {},
        { renderOptions: undefined },
      )
    })

    it('应该根据扩展名正确确定文件类型', async () => {
      mockUtils.extractCallDir.mockReturnValue('/caller/dir')
      mockUtils.isDirectory.mockResolvedValue(false)

      // 测试 .tpl 文件
      await renderCallback('template.txt.tpl', {})
      expect(mockApi.copyTpl).toHaveBeenCalled()
      expect(mockApi.copyFile).not.toHaveBeenCalled()

      jest.clearAllMocks()

      // 测试常规文件
      await renderCallback('config.json', {})
      expect(mockApi.copyFile).toHaveBeenCalled()
      expect(mockApi.copyTpl).not.toHaveBeenCalled()
    })

    it('应该正确处理复杂的文件路径', async () => {
      mockUtils.extractCallDir.mockReturnValue('/base/project')
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
    expect(() => renderPlugin(mockApi)).not.toThrow()
  })
})
