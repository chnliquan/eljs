import * as importedModule0 from '@eljs/utils'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PluginOptions } from '../src'
import { Plugin, PluginHostErrorCode, PluginKind } from '../src'
import { SUPPORTED_PLUGIN_EXTENSIONS } from '../src/plugin/plugin-formats'
import {
  resolvePluginDeclarations,
  resolvePresetsAndPlugins,
} from '../src/plugin/plugin-resolver'
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
  fileLoaders: {
    '.cjs': vi.fn().mockResolvedValue(vi.fn()),
    '.js': vi.fn().mockResolvedValue(vi.fn()),
    '.mjs': vi.fn().mockResolvedValue(vi.fn()),
  },
  camelCase: vi
    .fn()
    .mockImplementation((str: string) =>
      str.replace(/-([a-z])/g, g => g[1].toUpperCase()),
    ),
}))

const { fileLoaders, fileLoadersSync, findUp, isPathExistsSync } =
  requiredModule0

describe('插件', () => {
  let mockCwd: string
  let validOptions: PluginOptions

  beforeEach(() => {
    mockCwd = createTempDir()
    validOptions = {
      path: '/mock/plugin/index.js',
      type: PluginKind.Plugin,
      cwd: mockCwd,
    }

    // Reset mocks
    isPathExistsSync.mockReturnValue(true)
    fileLoadersSync['.js'].mockReturnValue({ default: vi.fn() })
    fileLoaders['.js'].mockResolvedValue(vi.fn())
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create plugin with valid options', () => {
      const plugin = new Plugin(validOptions)

      expect(plugin.path).toBe('/mock/plugin/index.js')
      expect(plugin.type).toBe(PluginKind.Plugin)
      expect(plugin.constructorOptions).toEqual(validOptions)
      expect(plugin.getDiagnostics().metrics).toMatchObject({
        hookDurationsMs: {},
        hookErrorCounts: {},
      })
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
        type: PluginKind.Preset,
      })

      expect(plugin.type).toBe(PluginKind.Preset)
    })

    it('should reject unsupported plugin extensions', () => {
      expect(
        () =>
          new Plugin({
            ...validOptions,
            path: '/mock/plugin/index.mts',
          }),
      ).toThrow(
        expect.objectContaining({
          code: PluginHostErrorCode.UnsupportedPluginExtension,
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

    it('should resolve relative plugin paths from the configured cwd', () => {
      const plugin = new Plugin({
        ...validOptions,
        path: './plugins/example.js',
      })

      expect(plugin.path).toBe(path.join(mockCwd, 'plugins/example.js'))
      expect(plugin.constructorOptions.cwd).toBe(mockCwd)
    })
  })

  describe('loadInitializer method', () => {
    it('should return function from loaded module', async () => {
      const mockInitializer = vi.fn()
      fileLoaders['.js'].mockResolvedValue({ default: mockInitializer })

      const plugin = new Plugin(validOptions)
      const initializer = await plugin.loadInitializer()

      expect(initializer).toBe(mockInitializer)
    })

    it('should handle module without default export', async () => {
      const mockInitializer = vi.fn()
      fileLoaders['.js'].mockResolvedValue(mockInitializer)

      const plugin = new Plugin(validOptions)
      const initializer = await plugin.loadInitializer()

      expect(initializer).toBe(mockInitializer)
    })

    it('should throw error for non-function export', async () => {
      fileLoaders['.js'].mockResolvedValue({ default: 'not a function' })

      const plugin = new Plugin(validOptions)

      await expect(plugin.loadInitializer()).rejects.toThrow(
        'Load `plugin` failed in /mock/plugin/index.js, expected function, but got `not a function`.',
      )
    })

    it('should reject an invalid options schema attached to the initializer', async () => {
      const mockInitializer = vi.fn()
      Object.defineProperty(mockInitializer, 'optionsSchema', {
        value: {},
      })
      fileLoaders['.js'].mockResolvedValue({ default: mockInitializer })

      const plugin = new Plugin(validOptions)

      await expect(plugin.loadInitializer()).rejects.toMatchObject({
        code: PluginHostErrorCode.InvalidPluginExport,
      })
    })
  })

  describe('configure method', () => {
    it('should configure key option', () => {
      const plugin = new Plugin(validOptions)
      const originalKey = plugin.key

      plugin.configure({ key: 'newKey' })

      expect(plugin.key).toBe('newKey')
      expect(plugin.key).not.toBe(originalKey)
    })

    it('should configure enable option', () => {
      const plugin = new Plugin(validOptions)
      const enableFn = () => false

      plugin.configure({ enable: enableFn })

      expect(plugin.enable).toBe(enableFn)
    })

    it('should support a static false enable option', () => {
      const plugin = new Plugin(validOptions)

      plugin.configure({ enable: false })

      expect(plugin.enable).toBe(false)
    })

    it('should handle partial configuration', () => {
      const plugin = new Plugin(validOptions)
      const originalKey = plugin.key

      plugin.configure({ enable: () => true })

      expect(plugin.key).toBe(originalKey) // Should not change
      expect(typeof plugin.enable).toBe('function')
      expect(typeof plugin.enable === 'function' && plugin.enable()).toBe(true)
    })

    it.each([null, { key: '' }, { key: ' padded ' }, { enable: 'yes' }])(
      'should reject invalid plugin descriptions %#',
      description => {
        const plugin = new Plugin(validOptions)

        expect(() =>
          plugin.configure(
            description as unknown as Parameters<Plugin['configure']>[0],
          ),
        ).toThrow(
          expect.objectContaining({
            code: PluginHostErrorCode.InvalidOptions,
          }),
        )
      },
    )
  })

  describe('static methods', () => {
    describe('stripNonEljsScope', () => {
      it('should strip scope from scoped package name', () => {
        const result = Plugin.stripNonEljsScope('@scope/package-name')
        expect(result).toBe('package-name')
      })

      it('should not strip @eljs scope', () => {
        const result = Plugin.stripNonEljsScope('@eljs/package-name')
        expect(result).toBe('@eljs/package-name')
      })

      it('should return name unchanged for non-scoped package', () => {
        const result = Plugin.stripNonEljsScope('package-name')
        expect(result).toBe('package-name')
      })
    })

    describe('getPresetsAndPlugins', () => {
      it('should return empty when no presets or plugins', () => {
        const result = resolvePresetsAndPlugins(mockCwd)

        expect(result).toEqual({
          presets: undefined,
          plugins: undefined,
        })
      })

      it('should handle empty arrays', () => {
        const result = resolvePresetsAndPlugins(mockCwd, [], [])

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
        const result = resolvePluginDeclarations(
          ['plugin-name'],
          PluginKind.Plugin,
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
        const result = resolvePluginDeclarations(
          [['plugin-name', options]],
          PluginKind.Plugin,
          mockCwd,
        )

        expect(result).toHaveLength(1)
        expect(result[0][0]).toBeInstanceOf(Plugin)
        expect(result[0][1]).toEqual(options)
      })

      it('应该拒绝空的插件名', () => {
        expect(() =>
          resolvePluginDeclarations([''], PluginKind.Plugin, mockCwd),
        ).toThrow(
          expect.objectContaining({
            code: PluginHostErrorCode.InvalidPluginDeclaration,
          }),
        )
      })

      it('应该对无法解析的插件抛出错误', () => {
        const { resolve } = requiredModule0
        resolve.sync.mockImplementation(() => {
          throw new Error('Cannot resolve module')
        })

        expect(() => {
          resolvePluginDeclarations(
            ['invalid-plugin'],
            PluginKind.Plugin,
            mockCwd,
          )
        }).toThrow('Invalid plugin `invalid-plugin`, can not be resolved.')
      })
    })

    describe('getPresetsAndPlugins 完整场景', () => {
      beforeEach(() => {
        requiredModule0.resolve.sync.mockReturnValue('/resolved/plugin/path.js')
      })

      it('应该返回解析后的预设和插件', () => {
        const result = resolvePresetsAndPlugins(
          mockCwd,
          ['preset1'],
          ['plugin1'],
        )

        expect(result.presets).toHaveLength(1)
        expect(result.plugins).toHaveLength(1)
      })

      it('应该处理只有预设的情况', () => {
        const result = resolvePresetsAndPlugins(mockCwd, ['preset1'], undefined)

        expect(result.presets).toHaveLength(1)
        expect(result.plugins).toBeUndefined()
      })

      it('应该处理只有插件的情况', () => {
        const result = resolvePresetsAndPlugins(mockCwd, undefined, ['plugin1'])

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

      it('应该处理 TypeScript 文件扩展名', async () => {
        const tsOptions = {
          ...validOptions,
          path: '/mock/plugin/index.ts',
        }

        Object.assign(fileLoadersSync, {
          '.ts': vi.fn().mockReturnValue({ default: vi.fn() }),
        })

        const plugin = new Plugin(tsOptions)
        const initializer = await plugin.loadInitializer()

        expect(typeof initializer).toBe('function')
      })

      it('应该处理加载模块时的错误', async () => {
        fileLoaders['.js'].mockRejectedValue(
          new Error('Load /some/path failed: module not found'),
        )

        const plugin = new Plugin(validOptions)

        await expect(plugin.loadInitializer()).rejects.toThrow(
          /Load `plugin` failed in .*: module not found/,
        )
      })
    })
  })
})
