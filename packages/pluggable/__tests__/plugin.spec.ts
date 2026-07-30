import * as importedModule0 from '@eljs/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PluginOptions } from '../src'
import {
  PluggableErrorCode,
  Plugin,
  PluginTypeEnum,
  SUPPORTED_PLUGIN_EXTENSIONS,
} from '../src'
import { createTempDir } from './setup'

const requiredModule0 = vi.mocked(importedModule0, { deep: true })

// Mock dependencies
vi.mock('@eljs/utils', () => ({
  findUp: {
    sync: vi.fn().mockReturnValue('/mock/package.json'),
  },
  isPathExistsSync: vi.fn().mockReturnValue(true),
  readJsonSync: vi
    .fn()
    .mockReturnValue({ name: 'test-plugin', main: 'index.js' }),
  resolve: {
    sync: vi.fn().mockReturnValue('/resolved/path/plugin.js'),
  },
  winPath: vi.fn((path: string) => path),
  fileLoadersSync: {
    '.js': vi.fn().mockReturnValue({ default: vi.fn() }),
    '.ts': vi.fn().mockReturnValue({ default: vi.fn() }),
  },
  camelCase: vi
    .fn()
    .mockImplementation((str: string) =>
      str.replace(/-([a-z])/g, g => g[1].toUpperCase()),
    ),
}))

const { fileLoadersSync, findUp, isPathExistsSync } = requiredModule0

describe('插件', () => {
  let mockCwd: string
  let validOptions: PluginOptions

  beforeEach(() => {
    mockCwd = createTempDir()
    validOptions = {
      path: '/mock/plugin/index.js',
      type: PluginTypeEnum.Plugin,
      cwd: mockCwd,
    }

    // Reset mocks
    isPathExistsSync.mockReturnValue(true)
    fileLoadersSync['.js'].mockReturnValue({ default: vi.fn() })
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create plugin with valid options', () => {
      const plugin = new Plugin(validOptions)

      expect(plugin.path).toBe('/mock/plugin/index.js')
      expect(plugin.type).toBe(PluginTypeEnum.Plugin)
      expect(plugin.constructorOptions).toEqual(validOptions)
      expect(plugin.time).toEqual({ hooks: {}, hookErrors: {} })
      expect(plugin.enable).toBe(true)
      expect(plugin.id).toBeTruthy()
      expect(plugin.key).toBeTruthy()
    })

    it('should throw error for non-existent path', () => {
      isPathExistsSync.mockReturnValue(false)

      expect(() => new Plugin(validOptions)).toThrow(
        'Invalid `plugin` in /mock/plugin/index.js, could not be found.',
      )
    })

    it('should handle preset type', () => {
      const plugin = new Plugin({
        ...validOptions,
        type: PluginTypeEnum.Preset,
      })

      expect(plugin.type).toBe(PluginTypeEnum.Preset)
    })

    it('should reject unsupported plugin extensions', () => {
      expect(
        () =>
          new Plugin({
            ...validOptions,
            path: '/mock/plugin/index.mjs',
          }),
      ).toThrow(
        expect.objectContaining({
          code: PluggableErrorCode.UnsupportedPluginExtension,
        }),
      )
    })

    it('should generate plugin ID and key', () => {
      const plugin = new Plugin(validOptions)

      expect(plugin.id).toBeDefined()
      expect(plugin.key).toBeDefined()
      expect(typeof plugin.id).toBe('string')
      expect(typeof plugin.key).toBe('string')
    })
  })

  describe('apply method', () => {
    it('should return function from loaded module', () => {
      const mockApplyFn = vi.fn()
      fileLoadersSync['.js'].mockReturnValue({ default: mockApplyFn })

      const plugin = new Plugin(validOptions)
      const applyResult = plugin.apply()

      expect(applyResult).toBe(mockApplyFn)
    })

    it('should handle module without default export', () => {
      const mockApplyFn = vi.fn()
      fileLoadersSync['.js'].mockReturnValue(mockApplyFn)

      const plugin = new Plugin(validOptions)
      const applyResult = plugin.apply()

      expect(applyResult).toBe(mockApplyFn)
    })

    it('should throw error for non-function export', () => {
      fileLoadersSync['.js'].mockReturnValue({ default: 'not a function' })

      const plugin = new Plugin(validOptions)

      expect(() => plugin.apply()).toThrow(
        'Load `plugin` failed in /mock/plugin/index.js, expected function, but got `not a function`.',
      )
    })
  })

  describe('merge method', () => {
    it('should merge key option', () => {
      const plugin = new Plugin(validOptions)
      const originalKey = plugin.key

      plugin.merge({ key: 'newKey' })

      expect(plugin.key).toBe('newKey')
      expect(plugin.key).not.toBe(originalKey)
    })

    it('should merge enable option', () => {
      const plugin = new Plugin(validOptions)
      const enableFn = () => false

      plugin.merge({ enable: enableFn })

      expect(plugin.enable).toBe(enableFn)
    })

    it('should support a static false enable option', () => {
      const plugin = new Plugin(validOptions)

      plugin.merge({ enable: false })

      expect(plugin.enable).toBe(false)
    })

    it('should handle partial merge', () => {
      const plugin = new Plugin(validOptions)
      const originalKey = plugin.key

      plugin.merge({ enable: () => true })

      expect(plugin.key).toBe(originalKey) // Should not change
      expect(typeof plugin.enable).toBe('function')
      expect(typeof plugin.enable === 'function' && plugin.enable()).toBe(true)
    })
  })

  describe('static methods', () => {
    describe('stripNoneScope', () => {
      it('should strip scope from scoped package name', () => {
        const result = Plugin.stripNoneScope('@scope/package-name')
        expect(result).toBe('package-name')
      })

      it('should not strip @eljs scope', () => {
        const result = Plugin.stripNoneScope('@eljs/package-name')
        expect(result).toBe('@eljs/package-name')
      })

      it('should return name unchanged for non-scoped package', () => {
        const result = Plugin.stripNoneScope('package-name')
        expect(result).toBe('package-name')
      })
    })

    describe('getPresetsAndPlugins', () => {
      it('should return empty when no presets or plugins', () => {
        const result = Plugin.getPresetsAndPlugins(mockCwd)

        expect(result).toEqual({
          presets: undefined,
          plugins: undefined,
        })
      })

      it('should handle empty arrays', () => {
        const result = Plugin.getPresetsAndPlugins(mockCwd, [], [])

        expect(result).toEqual({
          presets: undefined,
          plugins: undefined,
        })
      })
    })

    describe('resolvePlugins', () => {
      beforeEach(() => {
        const { resolve } = requiredModule0
        resolve.sync.mockReturnValue('/resolved/plugin/path.js')
      })

      it('应该解析字符串插件声明', () => {
        const result = Plugin.resolvePlugins(
          ['plugin-name'],
          PluginTypeEnum.Plugin,
          mockCwd,
        )

        expect(result).toHaveLength(1)
        expect(result[0][0]).toBeInstanceOf(Plugin)
        expect(result[0][1]).toBeUndefined()
        expect(requiredModule0.resolve.sync).toHaveBeenCalledWith(
          'plugin-name',
          {
            basedir: mockCwd,
            extensions: [...SUPPORTED_PLUGIN_EXTENSIONS].reverse(),
          },
        )
      })

      it('应该解析带有选项的插件声明', () => {
        const options = { option1: 'value1' }
        const result = Plugin.resolvePlugins(
          [['plugin-name', options]],
          PluginTypeEnum.Plugin,
          mockCwd,
        )

        expect(result).toHaveLength(1)
        expect(result[0][0]).toBeInstanceOf(Plugin)
        expect(result[0][1]).toEqual(options)
      })

      it('应该过滤空的插件名', () => {
        const result = Plugin.resolvePlugins(
          ['', 'valid-plugin'],
          PluginTypeEnum.Plugin,
          mockCwd,
        )

        expect(result).toHaveLength(1)
        expect(result[0][0]).toBeInstanceOf(Plugin)
      })

      it('应该对无法解析的插件抛出错误', () => {
        const { resolve } = requiredModule0
        resolve.sync.mockImplementation(() => {
          throw new Error('Cannot resolve module')
        })

        expect(() => {
          Plugin.resolvePlugins(
            ['invalid-plugin'],
            PluginTypeEnum.Plugin,
            mockCwd,
          )
        }).toThrow('Invalid plugin `invalid-plugin`, can not be resolved.')
      })
    })

    describe('getPresetsAndPlugins 完整场景', () => {
      beforeEach(() => {
        vi.spyOn(Plugin, 'resolvePlugins').mockReturnValue([
          [new Plugin(validOptions), {}],
        ])
      })

      it('应该返回解析后的预设和插件', () => {
        const result = Plugin.getPresetsAndPlugins(
          mockCwd,
          ['preset1'],
          ['plugin1'],
        )

        expect(result.presets).toHaveLength(1)
        expect(result.plugins).toHaveLength(1)
      })

      it('应该处理只有预设的情况', () => {
        const result = Plugin.getPresetsAndPlugins(
          mockCwd,
          ['preset1'],
          undefined,
        )

        expect(result.presets).toHaveLength(1)
        expect(result.plugins).toBeUndefined()
      })

      it('应该处理只有插件的情况', () => {
        const result = Plugin.getPresetsAndPlugins(mockCwd, undefined, [
          'plugin1',
        ])

        expect(result.presets).toBeUndefined()
        expect(result.plugins).toHaveLength(1)
      })
    })

    describe('constructor 边界情况', () => {
      it('应该处理没有package.json的情况', () => {
        findUp.sync.mockReturnValue(undefined)

        const plugin = new Plugin(validOptions)

        expect(plugin).toBeInstanceOf(Plugin)
        expect(plugin.id).toBeTruthy()
        expect(plugin.key).toBeTruthy()
      })

      it('应该处理不同的文件扩展名', () => {
        const tsOptions = {
          ...validOptions,
          path: '/mock/plugin/index.ts',
        }

        Object.assign(fileLoadersSync, {
          '.ts': vi.fn().mockReturnValue({ default: vi.fn() }),
        })

        const plugin = new Plugin(tsOptions)
        const applyResult = plugin.apply()

        expect(typeof applyResult).toBe('function')
      })

      it('应该处理加载模块时的错误', () => {
        fileLoadersSync['.js'].mockImplementation(() => {
          const error = new Error('Load /some/path failed: module not found')
          throw error
        })

        const plugin = new Plugin(validOptions)

        expect(() => plugin.apply()).toThrow(
          /Load `plugin` failed in .*: module not found/,
        )
      })
    })
  })
})
