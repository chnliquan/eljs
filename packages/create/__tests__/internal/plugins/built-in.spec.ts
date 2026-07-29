import type { PackageJson } from '@eljs/utils'
import * as mockedUtils from '@eljs/utils'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mocked,
  type MockedFunction,
} from 'vitest'

import builtInPlugin from '../../../src/internal/plugins/built-in'
import type { Api } from '../../../src/types'

// Mock @eljs/utils
vi.mock('@eljs/utils', () => ({
  chalk: {
    cyan: { bold: (str: string) => `CYAN_BOLD(${str})` },
  },
  deepMerge: vi.fn((target: PackageJson, source: PackageJson) => ({
    ...target,
    ...source,
  })),
  install: vi.fn(),
  isObject: vi.fn(
    (obj: unknown): obj is object =>
      obj !== null && typeof obj === 'object' && !Array.isArray(obj),
  ),
  isPathExists: vi.fn(),
  logger: {
    info: vi.fn(),
    ready: vi.fn(),
  },
  readJson: vi.fn(),
  writeJson: vi.fn(),
}))

// Mock node:path
vi.mock('node:path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
}))

// Mock dynamic import for sort-package-json
const mockSortPackageJson = vi.fn((pkg: PackageJson) => pkg)
vi.mock('sort-package-json', () => ({ default: mockSortPackageJson }))

// Mock types
interface MockUtils {
  chalk: {
    cyan: { bold: (str: string) => string }
  }
  deepMerge: MockedFunction<
    (target: PackageJson, source: PackageJson) => PackageJson
  >
  install: MockedFunction<(...args: unknown[]) => Promise<void>>
  isObject: MockedFunction<(obj: unknown) => boolean>
  isPathExists: MockedFunction<(path: string) => Promise<boolean>>
  logger: {
    info: MockedFunction<(message: string) => void>
    ready: MockedFunction<(message: string) => void>
  }
  readJson: MockedFunction<(path: string) => Promise<PackageJson>>
  writeJson: MockedFunction<(path: string, data: PackageJson) => Promise<void>>
}

describe('内部插件 built-in', () => {
  let mockApi: Mocked<Api>
  let extendPackageCallback: (pkg: unknown) => unknown
  let installCallback: (...args: unknown[]) => Promise<void>
  let onGenerateDoneCallbacks: Array<() => Promise<void>>
  let mockUtils: MockUtils

  beforeEach(() => {
    onGenerateDoneCallbacks = []
    mockUtils = mockedUtils as unknown as MockUtils

    mockApi = {
      registerMethod: vi.fn((name: string, fn: unknown) => {
        if (name === 'extendPackage') {
          extendPackageCallback = fn as (pkg: unknown) => unknown
        } else if (name === 'install') {
          installCallback = fn as (...args: unknown[]) => Promise<void>
        }
      }),
      onGenerateDone: vi.fn((callback: () => Promise<void>) => {
        onGenerateDoneCallbacks.push(callback)
      }),
      appData: {
        // 每次都创建新对象避免状态污染
        pkg: { name: 'test-package', version: '1.0.0' },
        packageManager: 'pnpm' as const,
        projectName: 'test-project',
      },
      paths: {
        target: '/test/project',
      },
      config: {
        install: true,
      },
      install: vi.fn(),
    } as unknown as Mocked<Api>

    vi.clearAllMocks()

    // 确保每次测试都有新的 pkg 对象
    mockApi.appData.pkg = { name: 'test-package', version: '1.0.0' }
  })

  it('应该是一个函数', () => {
    expect(typeof builtInPlugin).toBe('function')
  })

  it('应该注册 extendPackage 方法', () => {
    builtInPlugin(mockApi)

    expect(mockApi.registerMethod).toHaveBeenCalledWith(
      'extendPackage',
      expect.any(Function),
    )
  })

  it('应该注册 install 方法', () => {
    builtInPlugin(mockApi)

    expect(mockApi.registerMethod).toHaveBeenCalledWith(
      'install',
      expect.any(Function),
    )
  })

  it('应该注册 onGenerateDone 钩子', () => {
    builtInPlugin(mockApi)

    expect(mockApi.onGenerateDone).toHaveBeenCalledTimes(2)

    // 第一个调用应该是 package.json 生成，stage 为 Number.NEGATIVE_INFINITY
    expect(mockApi.onGenerateDone).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      {
        stage: Number.NEGATIVE_INFINITY,
      },
    )

    // 第二个调用应该是最终步骤，stage 为 Infinity
    expect(mockApi.onGenerateDone).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      {
        stage: Infinity,
      },
    )
  })

  describe('extendPackage 方法', () => {
    it('应该通过对象扩展包配置', () => {
      builtInPlugin(mockApi)

      const newPkg = { scripts: { test: 'jest' } }
      const originalPkg = { ...mockApi.appData.pkg }

      extendPackageCallback(newPkg)

      expect(mockUtils.deepMerge).toHaveBeenCalledWith(originalPkg, newPkg)
    })

    it('应该通过函数扩展包配置', () => {
      builtInPlugin(mockApi)

      const originalPkg = { ...mockApi.appData.pkg }
      const fn = vi.fn((pkg: PackageJson) => ({
        ...pkg,
        scripts: { test: 'jest' },
      }))

      extendPackageCallback(fn)

      expect(fn).toHaveBeenCalledWith(originalPkg)
      expect(mockUtils.deepMerge).toHaveBeenCalled()
    })

    it('应该处理函数返回 null/undefined 的情况', () => {
      builtInPlugin(mockApi)

      const fn = vi.fn(() => null)
      extendPackageCallback(fn)

      expect(mockUtils.deepMerge).toHaveBeenCalledWith(mockApi.appData.pkg, {})
    })
  })

  describe('install 方法', () => {
    it('应该使用默认包管理器调用安装', async () => {
      builtInPlugin(mockApi)

      await installCallback()

      expect(mockUtils.logger.info).toHaveBeenCalledWith(
        '📦 Installing additional dependencies ...',
      )
      expect(mockUtils.install).toHaveBeenCalledWith('pnpm', [], {
        cwd: '/test/project',
        stdout: 'inherit',
      })
    })

    it('应该处理参数数组', async () => {
      builtInPlugin(mockApi)

      await installCallback(['react', 'vue'], { silent: true })

      expect(mockUtils.install).toHaveBeenCalledWith('pnpm', ['react', 'vue'], {
        cwd: '/test/project',
        stdout: 'inherit',
        silent: true,
      })
    })

    it('应该将参数作为选项对象处理', async () => {
      mockUtils.isObject.mockReturnValue(true)
      builtInPlugin(mockApi)

      await installCallback({ silent: true })

      expect(mockUtils.install).toHaveBeenCalledWith('pnpm', [], {
        cwd: '/test/project',
        stdout: 'inherit',
        silent: true,
      })
    })

    it('应该处理没有 packageManager 的情况', async () => {
      // 移除 packageManager 来测试默认值
      const appDataWithoutPackageManager = { ...mockApi.appData }
      delete (
        appDataWithoutPackageManager as Partial<
          typeof appDataWithoutPackageManager
        >
      ).packageManager
      mockApi.appData = appDataWithoutPackageManager as typeof mockApi.appData

      builtInPlugin(mockApi)

      await installCallback()

      expect(mockUtils.install).toHaveBeenCalledWith('pnpm', [], {
        cwd: '/test/project',
        stdout: 'inherit',
      })
    })
  })

  describe('onGenerateDone 钩子', () => {
    beforeEach(() => {
      // Mock dynamic import - 简化类型处理
      Object.defineProperty(global, 'import', {
        value: vi.fn(() => Promise.resolve({ default: mockSortPackageJson })),
        writable: true,
      })
    })

    it('应该处理文件存在时的 package.json 生成', async () => {
      mockUtils.isPathExists.mockResolvedValue(true)
      mockUtils.readJson.mockResolvedValue({ description: '现有包' })

      builtInPlugin(mockApi)

      await onGenerateDoneCallbacks[0]()

      expect(mockUtils.isPathExists).toHaveBeenCalledWith(
        '/test/project/package.json',
      )
      expect(mockUtils.readJson).toHaveBeenCalled()
      expect(mockUtils.deepMerge).toHaveBeenCalledWith(
        { description: '现有包' },
        mockApi.appData.pkg,
      )
      expect(mockUtils.writeJson).toHaveBeenCalled()
    })

    it('应该处理文件不存在时的 package.json 生成', async () => {
      mockUtils.isPathExists.mockResolvedValue(false)

      builtInPlugin(mockApi)

      await onGenerateDoneCallbacks[0]()

      expect(mockUtils.isPathExists).toHaveBeenCalledWith(
        '/test/project/package.json',
      )
      expect(mockUtils.readJson).not.toHaveBeenCalled()
      expect(mockUtils.writeJson).toHaveBeenCalled()
    })

    it('当 pkg 为空时应该跳过 package.json 生成', async () => {
      mockApi.appData.pkg = {}
      builtInPlugin(mockApi)

      await onGenerateDoneCallbacks[0]()

      expect(mockUtils.writeJson).not.toHaveBeenCalled()
    })

    it('应该在最终钩子中运行安装并显示成功消息', async () => {
      builtInPlugin(mockApi)

      await onGenerateDoneCallbacks[1]()

      expect(mockApi.install).toHaveBeenCalled()
      expect(mockUtils.logger.ready).toHaveBeenCalledWith(
        '🎉 Created project CYAN_BOLD(test-project) successfully.',
      )
    })

    it('当 config.install 为 false 时应该跳过安装', async () => {
      mockApi.config.install = false
      builtInPlugin(mockApi)

      await onGenerateDoneCallbacks[1]()

      expect(mockApi.install).not.toHaveBeenCalled()
      expect(mockUtils.logger.ready).toHaveBeenCalledWith(
        '🎉 Created project CYAN_BOLD(test-project) successfully.',
      )
    })
  })
})
