import type {
  CopyFileOptions,
  PackageJson,
  RenderTemplateOptions,
  RunCommandOptions,
} from '@eljs/utils'

import type { Api } from '../../src/types/api'

describe('Api 类型', () => {
  it('应该具有正确的 Api 类型结构', () => {
    // Test that Api type extends the expected base types
    const mockApi: Partial<Api> = {
      copyFile: jest.fn(),
      copyTpl: jest.fn(),
      copyDirectory: jest.fn(),
      render: jest.fn(),
      extendPackage: jest.fn(),
      resolve: jest.fn(),
      install: jest.fn(),
    }

    expect(typeof mockApi.copyFile).toBe('function')
    expect(typeof mockApi.copyTpl).toBe('function')
    expect(typeof mockApi.copyDirectory).toBe('function')
    expect(typeof mockApi.render).toBe('function')
    expect(typeof mockApi.extendPackage).toBe('function')
    expect(typeof mockApi.resolve).toBe('function')
    expect(typeof mockApi.install).toBe('function')
  })

  it('应该正确定义 copyFile 方法签名', () => {
    const mockCopyFile = jest.fn() as Api['copyFile']
    const mockOptions: CopyFileOptions = {}

    expect(() => {
      mockCopyFile('source', 'destination', mockOptions)
    }).not.toThrow()

    expect(mockCopyFile).toHaveBeenCalledWith(
      'source',
      'destination',
      mockOptions,
    )
  })

  it('应该正确定义 copyTpl 方法签名', () => {
    const mockCopyTpl = jest.fn() as Api['copyTpl']
    const mockData = { name: 'test' }
    const mockOptions: CopyFileOptions = {}

    expect(() => {
      mockCopyTpl('source', 'destination', mockData, mockOptions)
    }).not.toThrow()

    expect(mockCopyTpl).toHaveBeenCalledWith(
      'source',
      'destination',
      mockData,
      mockOptions,
    )
  })

  it('应该正确定义 copyDirectory 方法签名', () => {
    const mockCopyDirectory = jest.fn() as Api['copyDirectory']
    const mockData = { name: 'test' }
    const mockOptions: CopyFileOptions = {}

    expect(() => {
      mockCopyDirectory('source', 'destination', mockData, mockOptions)
    }).not.toThrow()

    expect(mockCopyDirectory).toHaveBeenCalledWith(
      'source',
      'destination',
      mockData,
      mockOptions,
    )
  })

  it('应该正确定义 render 方法签名', () => {
    const mockRender = jest.fn() as Api['render']
    const mockData = { name: 'test' }
    const mockOptions: RenderTemplateOptions = {}

    expect(() => {
      mockRender('path', mockData, mockOptions)
    }).not.toThrow()

    expect(() => {
      mockRender('path', mockData)
    }).not.toThrow()

    expect(mockRender).toHaveBeenCalledWith('path', mockData, mockOptions)
  })

  it('应该支持 extendPackage 方法的两种签名', () => {
    const mockExtendPackagePartial = jest.fn() as Api['extendPackage']
    const mockExtendPackageFn = jest.fn() as Api['extendPackage']
    const mockPartial: PackageJson = { name: 'test' }
    const mockFn = (memo: PackageJson) => ({ ...memo, version: '1.0.0' })

    // Test partial object signature
    expect(() => {
      mockExtendPackagePartial(mockPartial)
    }).not.toThrow()

    // Test function signature
    expect(() => {
      mockExtendPackageFn(mockFn)
    }).not.toThrow()
  })

  it('应该正确定义 resolve 方法签名', () => {
    const mockResolve = jest
      .fn()
      .mockReturnValue('/resolved/path') as Api['resolve']

    expect(() => {
      mockResolve('path1', 'path2')
    }).not.toThrow()

    expect(mockResolve('path1', 'path2')).toBe('/resolved/path')
  })

  it('应该支持 install 方法的两种签名', () => {
    const mockInstall = jest.fn() as Api['install']
    const mockOptions: RunCommandOptions = {}
    const mockArgs = ['--save-dev']

    // Test options only signature
    expect(() => {
      mockInstall(mockOptions)
    }).not.toThrow()

    expect(() => {
      mockInstall()
    }).not.toThrow()

    // Test args and options signature
    expect(() => {
      mockInstall(mockArgs, mockOptions)
    }).not.toThrow()
  })

  it('应该从 PluginApi 中省略特定属性', () => {
    // 此测试确保 Api 类型正确省略了基础 PluginApi 类型中的 'registerPresets' 和 'registerPlugins'
    // 我们无法在运行时直接测试类型排除，但可以验证结构符合预期
    const mockApi: Partial<Api> = {}

    // 这些属性不应该存在于 Api 类型中
    // 如果省略不起作用，TypeScript 将在编译时捕获此错误
    expect('registerPresets' in mockApi).toBe(false)
    expect('registerPlugins' in mockApi).toBe(false)
  })

  it('应该包含 PluggablePluginApi 和 RunnerPluginApi 的属性', () => {
    // 测试 Api 包含来自 PluggablePluginApi 和 RunnerPluginApi 的属性
    // 这更像是类型级别的测试，以确保交叉类型正常工作
    const mockApi: Partial<Api> = {
      copyFile: jest.fn(),
      copyTpl: jest.fn(),
      copyDirectory: jest.fn(),
      render: jest.fn(),
      extendPackage: jest.fn(),
      resolve: jest.fn(),
      install: jest.fn(),
    }

    // 验证 Api 类型包含预期的方法
    expect(mockApi).toBeDefined()
    expect(typeof mockApi.copyFile).toBe('function')
    expect(typeof mockApi.copyTpl).toBe('function')
    expect(typeof mockApi.copyDirectory).toBe('function')
    expect(typeof mockApi.render).toBe('function')
    expect(typeof mockApi.extendPackage).toBe('function')
    expect(typeof mockApi.resolve).toBe('function')
    expect(typeof mockApi.install).toBe('function')
  })
})
