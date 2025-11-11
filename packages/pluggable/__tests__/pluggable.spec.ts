/* eslint-disable @typescript-eslint/no-explicit-any */
import { Pluggable } from '../src/pluggable/pluggable'
import type { PluggableOptions } from '../src/pluggable/types'
import { ApplyPluginTypeEnum, PluggableStateEnum } from '../src/pluggable/types'
import type { Hook } from '../src/plugin/hook'
import { Plugin } from '../src/plugin/plugin'
import { PluginTypeEnum } from '../src/plugin/types'
import { createTempDir } from './setup'

// Mock the config manager
jest.mock('@eljs/config', () => ({
  ConfigManager: jest.fn().mockImplementation(() => ({
    getConfig: jest.fn().mockResolvedValue({}),
  })),
}))

// Mock utils with simple implementations
jest.mock('@eljs/utils', () => ({
  isPathExistsSync: jest.fn().mockReturnValue(true),
  isFunction: jest.fn().mockReturnValue(true),
  winPath: jest.fn().mockImplementation(path => path || 'mocked-path'),
  camelCase: jest.fn().mockImplementation(str => str || 'mockedCase'),
  readJsonSync: jest
    .fn()
    .mockReturnValue({ main: 'index.js', name: 'test-package' }),
  fileLoadersSync: jest.fn().mockReturnValue(() => ({})),
  resolve: jest.fn().mockImplementation(str => str || 'resolved-path'),
}))

// Mock hash-sum
jest.mock('hash-sum', () => jest.fn().mockReturnValue('mocked-hash'))

// Mock pkg-up
jest.mock('pkg-up', () => ({
  sync: jest.fn().mockReturnValue('/mock/package.json'),
}))

// Mock path functions
jest.mock('node:path', () => ({
  basename: jest
    .fn()
    .mockImplementation(path => path?.split('/').pop() || 'mocked-basename'),
  dirname: jest
    .fn()
    .mockImplementation(
      path => path?.split('/').slice(0, -1).join('/') || 'mocked-dirname',
    ),
  extname: jest.fn().mockReturnValue('.js'),
  join: jest
    .fn()
    .mockImplementation((...paths) => paths.join('/') || 'mocked-joined-path'),
  relative: jest
    .fn()
    .mockImplementation((from, to) => to || 'mocked-relative-path'),
}))

// Create a testable subclass to access protected methods
class TestablePluggable extends Pluggable {
  // Expose protected method for testing
  public testIsPluginEnable(hook: Hook | string): boolean {
    return this.isPluginEnable(hook)
  }

  // Provide a way to set state for testing
  public setStateForTesting(state: PluggableStateEnum): void {
    // Use bracket notation to access private property
    ;(this as any)._state = state
  }
}

// Helper function to create test plugin
function createTestPlugin(
  cwd: string,
  id: string,
  overrides: Partial<Plugin> = {},
): Plugin {
  const plugin = new Plugin({
    type: PluginTypeEnum.Plugin,
    path: '/mock/path',
    cwd,
  })

  // Override properties for testing
  Object.assign(plugin, {
    id,
    key: id,
    enable: () => true,
    time: { hooks: {} },
    ...overrides,
  })

  return plugin
}

// Helper function to create test hook
function createTestHook(
  cwd: string,
  pluginData: Partial<Plugin> = {},
  hookData: Partial<Hook> = {},
): Hook {
  const plugin = createTestPlugin(cwd, 'test-plugin', pluginData)

  return {
    constructorOptions: {
      plugin,
      key: 'testHook',
      fn: jest.fn(),
      ...hookData,
    },
    plugin,
    key: 'testHook',
    fn: jest.fn(),
    ...hookData,
  } as Hook
}

describe('Pluggable', () => {
  let mockCwd: string
  let pluggable: TestablePluggable

  beforeEach(() => {
    mockCwd = createTempDir()
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create Pluggable instance with valid options', () => {
      const options: PluggableOptions = {
        cwd: mockCwd,
        presets: [],
        plugins: [],
        defaultConfigFiles: ['config.js'],
      }

      pluggable = new TestablePluggable(options)

      expect(pluggable.constructorOptions).toEqual(options)
      expect(pluggable.cwd).toBe(mockCwd)
      expect(pluggable.state).toBe(PluggableStateEnum.Uninitialized)
      expect(pluggable.hooks).toEqual({})
      expect(pluggable.plugins).toEqual({})
      expect(pluggable.key2Plugin).toEqual({})
      expect(pluggable.pluginMethods).toEqual({})
      expect(pluggable.skippedPluginIds).toBeInstanceOf(Set)
    })

    it('should handle missing optional properties', () => {
      const minimalOptions: PluggableOptions = { cwd: mockCwd }
      pluggable = new TestablePluggable(minimalOptions)

      expect(pluggable.constructorOptions.presets).toBeUndefined()
      expect(pluggable.constructorOptions.plugins).toBeUndefined()
    })
  })

  describe('applyPlugins - type inference', () => {
    beforeEach(() => {
      pluggable = new TestablePluggable({ cwd: mockCwd })
      // Set state to loaded to allow applyPlugins
      pluggable.setStateForTesting(PluggableStateEnum.Loaded)
    })

    it('should infer Event type from "on" prefix', async () => {
      pluggable.hooks['onStart'] = []

      const result = await pluggable.applyPlugins('onStart')

      expect(result).toBe(0) // tapable returns 0 for event hooks
    })

    it('should infer Get type from "get" prefix', async () => {
      pluggable.hooks['getConfig'] = []

      const result = await pluggable.applyPlugins('getConfig')

      expect(result).toBeUndefined() // AsyncSeriesBailHook returns undefined when no results
    })

    it('should infer Modify type from "modify" prefix', async () => {
      pluggable.hooks['modifyConfig'] = []

      const result = await (pluggable as any).applyPlugins('modifyConfig', {
        initialValue: { test: true },
      })

      expect(result).toEqual({ test: true })
    })

    it('should infer Add type from "add" prefix', async () => {
      pluggable.hooks['addPlugins'] = []

      const result = await pluggable.applyPlugins('addPlugins')

      expect(result).toEqual([])
    })

    it('should throw error for ambiguous key without type', async () => {
      await expect(pluggable.applyPlugins('ambiguousKey')).rejects.toThrow(
        'Invalid applyPlugins arguments, `type` must be supplied for key `ambiguousKey`.',
      )
    })

    it('should throw error for invalid type', async () => {
      await expect(
        pluggable.applyPlugins('testKey', { type: 'invalid' as any }),
      ).rejects.toThrow(
        'ApplyPlugins failed, `type` not defined or matched, got `invalid`.',
      )
    })
  })

  describe('isPluginEnable', () => {
    beforeEach(() => {
      pluggable = new TestablePluggable({ cwd: mockCwd })
    })

    it('should return true for enabled plugin hook', () => {
      const hook = createTestHook(mockCwd, {
        id: 'test-plugin',
        enable: () => true,
      })

      const result = pluggable.testIsPluginEnable(hook)

      expect(result).toBe(true)
    })

    it('should return false for disabled plugin hook', () => {
      const hook = createTestHook(mockCwd, {
        id: 'test-plugin',
        enable: () => false,
      })

      const result = pluggable.testIsPluginEnable(hook)

      expect(result).toBe(false)
    })

    it('should return false for skipped plugin', () => {
      const hook = createTestHook(mockCwd, {
        id: 'skipped-plugin',
        enable: () => true,
      })

      pluggable.skippedPluginIds.add('skipped-plugin')

      const result = pluggable.testIsPluginEnable(hook)

      expect(result).toBe(false)
    })

    it('should handle plugin key string parameter', () => {
      pluggable.key2Plugin['test-plugin'] = createTestPlugin(
        mockCwd,
        'test-plugin-id',
        {
          enable: () => true,
        },
      )

      const result = pluggable.testIsPluginEnable('test-plugin')

      expect(result).toBe(true)
    })

    it('should handle function enable condition', () => {
      const enableFn = jest.fn().mockReturnValue(false)
      const hook = createTestHook(mockCwd, {
        id: 'test-plugin',
        enable: enableFn as any,
      })

      const result = pluggable.testIsPluginEnable(hook)

      expect(result).toBe(false)
      expect(enableFn).toHaveBeenCalled()
    })
  })

  describe('basic hook execution', () => {
    beforeEach(() => {
      pluggable = new TestablePluggable({ cwd: mockCwd })
      pluggable.setStateForTesting(PluggableStateEnum.Loaded)
    })

    it('should execute add hooks correctly', async () => {
      const mockFn = jest.fn().mockResolvedValue(['item1'])
      const plugin = createTestPlugin(mockCwd, 'plugin1', {
        time: { hooks: {} as Record<string, number[]> },
      })
      const hook = {
        fn: mockFn,
        plugin,
        constructorOptions: { plugin, key: 'addItems', fn: mockFn },
        key: 'addItems',
      } as Hook
      pluggable.hooks['addItems'] = [hook]

      const result = await (pluggable as any).applyPlugins('addItems', {
        type: ApplyPluginTypeEnum.Add,
        initialValue: ['initial'],
      })

      expect(result).toEqual(['initial', 'item1'])
      expect(mockFn).toHaveBeenCalled()
    })

    it('should execute modify hooks correctly', async () => {
      const mockFn = jest.fn().mockResolvedValue({ modified: true })
      const plugin = createTestPlugin(mockCwd, 'plugin1', {
        time: { hooks: {} as Record<string, number[]> },
      })
      const hook = {
        fn: mockFn,
        plugin,
        constructorOptions: { plugin, key: 'modifyConfig', fn: mockFn },
        key: 'modifyConfig',
      } as Hook
      pluggable.hooks['modifyConfig'] = [hook]

      const result = await (pluggable as any).applyPlugins('modifyConfig', {
        type: ApplyPluginTypeEnum.Modify,
        initialValue: { original: true },
      })

      expect(result).toEqual({ modified: true })
      expect(mockFn).toHaveBeenCalledWith({ original: true }, undefined)
    })

    it('should skip disabled plugins in hook execution', async () => {
      const enabledFn = jest.fn().mockResolvedValue(['enabled'])
      const disabledFn = jest.fn().mockResolvedValue(['disabled'])

      const enabledPlugin = createTestPlugin(mockCwd, 'enabled-plugin', {
        time: { hooks: {} as Record<string, number[]> },
        enable: () => true,
      })
      const disabledPlugin = createTestPlugin(mockCwd, 'disabled-plugin', {
        time: { hooks: {} as Record<string, number[]> },
        enable: () => false,
      })

      const enabledHook = {
        fn: enabledFn,
        plugin: enabledPlugin,
        constructorOptions: {
          plugin: enabledPlugin,
          key: 'addItems',
          fn: enabledFn,
        },
        key: 'addItems',
      } as Hook
      const disabledHook = {
        fn: disabledFn,
        plugin: disabledPlugin,
        constructorOptions: {
          plugin: disabledPlugin,
          key: 'addItems',
          fn: disabledFn,
        },
        key: 'addItems',
      } as Hook

      pluggable.hooks['addItems'] = [enabledHook, disabledHook]

      const result = await (pluggable as any).applyPlugins('addItems', {
        type: ApplyPluginTypeEnum.Add,
        initialValue: [],
      })

      expect(result).toEqual(['enabled'])
      expect(enabledFn).toHaveBeenCalled()
      expect(disabledFn).not.toHaveBeenCalled()
    })

    it('should track hook execution performance', async () => {
      const mockFn = jest.fn().mockResolvedValue(['result'])
      const mockPlugin = createTestPlugin(mockCwd, 'test-plugin', {
        time: { hooks: {} as Record<string, number[]> },
      })
      const hook = {
        fn: mockFn,
        plugin: mockPlugin,
        constructorOptions: { plugin: mockPlugin, key: 'addItems', fn: mockFn },
        key: 'addItems',
      } as Hook

      pluggable.hooks['addItems'] = [hook]

      const result = await (pluggable as any).applyPlugins('addItems', {
        type: ApplyPluginTypeEnum.Add,
        initialValue: [],
      })

      expect(result).toEqual(['result'])
      expect(mockFn).toHaveBeenCalled()
      expect(mockPlugin.time.hooks['addItems']).toBeDefined()
      expect(mockPlugin.time.hooks['addItems']).toHaveLength(1)
      expect(typeof mockPlugin.time.hooks['addItems'][0]).toBe('number')
      expect(mockPlugin.time.hooks['addItems'][0]).toBeGreaterThanOrEqual(0)
    })
  })
})
