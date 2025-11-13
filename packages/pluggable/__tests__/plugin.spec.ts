/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/naming-convention */
import type { PluginOptions } from '../src'
import { Plugin, PluginTypeEnum } from '../src'
import { createTempDir } from './setup'

// Mock dependencies
jest.mock('pkg-up', () => ({
  sync: jest.fn().mockReturnValue('/mock/package.json'),
}))

jest.mock('@eljs/utils', () => ({
  isPathExistsSync: jest.fn().mockReturnValue(true),
  readJsonSync: jest
    .fn()
    .mockReturnValue({ name: 'test-plugin', main: 'index.js' }),
  resolve: {
    sync: jest.fn().mockReturnValue('/resolved/path/plugin.js'),
  },
  winPath: jest.fn((path: string) => path),
  fileLoadersSync: {
    '.js': jest.fn().mockReturnValue({ default: jest.fn() }),
    '.ts': jest.fn().mockReturnValue({ default: jest.fn() }),
  },
  camelCase: jest
    .fn()
    .mockImplementation((str: string) =>
      str.replace(/-([a-z])/g, g => g[1].toUpperCase()),
    ),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { isPathExistsSync, fileLoadersSync } = require('@eljs/utils')

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
    fileLoadersSync['.js'].mockReturnValue({ default: jest.fn() })
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create plugin with valid options', () => {
      const plugin = new Plugin(validOptions)

      expect(plugin.path).toBe('/mock/plugin/index.js')
      expect(plugin.type).toBe(PluginTypeEnum.Plugin)
      expect(plugin.constructorOptions).toEqual(validOptions)
      expect(plugin.time).toEqual({ hooks: {} })
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
      const mockApplyFn = jest.fn()
      fileLoadersSync['.js'].mockReturnValue({ default: mockApplyFn })

      const plugin = new Plugin(validOptions)
      const applyResult = plugin.apply()

      expect(applyResult).toBe(mockApplyFn)
    })

    it('should handle module without default export', () => {
      const mockApplyFn = jest.fn()
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

    it('should handle partial merge', () => {
      const plugin = new Plugin(validOptions)
      const originalKey = plugin.key

      plugin.merge({ enable: () => true })

      expect(plugin.key).toBe(originalKey) // Should not change
      expect(plugin.enable()).toBe(true)
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
        const { resolve } = require('@eljs/utils')
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
        expect(result[0][1]).toBeNull()
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
        const { resolve } = require('@eljs/utils')
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
        jest
          .spyOn(Plugin, 'resolvePlugins')
          .mockReturnValue([[new Plugin(validOptions), {}]])
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
        const pkgUp = require('pkg-up')
        pkgUp.sync.mockReturnValue(null)

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

        fileLoadersSync['.ts'] = jest
          .fn()
          .mockReturnValue({ default: jest.fn() })

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
