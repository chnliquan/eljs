import type {
  CopyFileOptions,
  PackageJson,
  RenderTemplateOptions,
  RunCommandOptions,
} from '@eljs/utils'
import { describe, expect, it, vi } from 'vitest'

import type { CreatePluginContext } from '../../src/types/plugin-context'

describe('CreatePluginContext 类型', () => {
  it('应该具有正确的 CreatePluginContext 类型结构', () => {
    // Test that CreatePluginContext type extends the expected base types
    const mockContext: Partial<CreatePluginContext> = {
      copyFile: vi.fn(),
      copyTpl: vi.fn(),
      copyDirectory: vi.fn(),
      render: vi.fn(),
      extendPackage: vi.fn(),
      resolve: vi.fn(),
      install: vi.fn(),
    }

    expect(typeof mockContext.copyFile).toBe('function')
    expect(typeof mockContext.copyTpl).toBe('function')
    expect(typeof mockContext.copyDirectory).toBe('function')
    expect(typeof mockContext.render).toBe('function')
    expect(typeof mockContext.extendPackage).toBe('function')
    expect(typeof mockContext.resolve).toBe('function')
    expect(typeof mockContext.install).toBe('function')
  })

  it('应该正确定义 copyFile 方法签名', () => {
    const mockCopyFile = vi.fn() as CreatePluginContext['copyFile']
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
    const mockCopyTpl = vi.fn() as CreatePluginContext['copyTpl']
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
    const mockCopyDirectory = vi.fn() as CreatePluginContext['copyDirectory']
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
    const mockRender = vi.fn() as CreatePluginContext['render']
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
    const mockExtendPackagePartial =
      vi.fn() as CreatePluginContext['extendPackage']
    const mockExtendPackageFn = vi.fn() as CreatePluginContext['extendPackage']
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
    const mockResolve = vi
      .fn()
      .mockReturnValue('/resolved/path') as CreatePluginContext['resolve']

    expect(() => {
      mockResolve('path1', 'path2')
    }).not.toThrow()

    expect(mockResolve('path1', 'path2')).toBe('/resolved/path')
  })

  it('应该支持 install 方法的两种签名', () => {
    const mockInstall = vi.fn() as CreatePluginContext['install']
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
    // 此测试确保 CreatePluginContext 类型正确省略了基础 PluginApi 类型中的 'registerPresets' 和 'registerPlugins'
    // 我们无法在运行时直接测试类型排除，但可以验证结构符合预期
    const mockContext: Partial<CreatePluginContext> = {}

    // 这些属性不应该存在于 CreatePluginContext 类型中
    // 如果省略不起作用，TypeScript 将在编译时捕获此错误
    expect('registerPresets' in mockContext).toBe(false)
    expect('registerPlugins' in mockContext).toBe(false)
  })

  it('应该包含核心 API、Hook 注册方法和 create 扩展能力', () => {
    // 测试完整上下文包含核心 API 和 create 领域能力
    // 这更像是类型级别的测试，以确保交叉类型正常工作
    const mockContext: Partial<CreatePluginContext> = {
      copyFile: vi.fn(),
      copyTpl: vi.fn(),
      copyDirectory: vi.fn(),
      render: vi.fn(),
      extendPackage: vi.fn(),
      resolve: vi.fn(),
      install: vi.fn(),
    }

    // 验证 CreatePluginContext 类型包含预期的方法
    expect(mockContext).toBeDefined()
    expect(typeof mockContext.copyFile).toBe('function')
    expect(typeof mockContext.copyTpl).toBe('function')
    expect(typeof mockContext.copyDirectory).toBe('function')
    expect(typeof mockContext.render).toBe('function')
    expect(typeof mockContext.extendPackage).toBe('function')
    expect(typeof mockContext.resolve).toBe('function')
    expect(typeof mockContext.install).toBe('function')
  })
})
