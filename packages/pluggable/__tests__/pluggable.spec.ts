import type { MaybePromiseFunction } from '@eljs/utils'
import { Pluggable } from '../src/pluggable/pluggable'
import type { PluggableOptions } from '../src/pluggable/types'
import { ApplyPluginTypeEnum, PluggableStateEnum } from '../src/pluggable/types'
import { Plugin, PluginApi } from '../src/plugin'
import type { Hook } from '../src/plugin/hook'
import { PluginTypeEnum } from '../src/plugin/types'
import { createTempDir } from './setup'

// Type helper for accessing internal pluggable methods
interface PluggableWithInternals {
  applyPlugins: (
    key: string,
    options?: {
      type?: ApplyPluginTypeEnum
      initialValue?: unknown
      args?: unknown
    },
  ) => Promise<unknown>
}

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
    ;(this as unknown as { _state: PluggableStateEnum })._state = state
  }

  // Expose protected load method for testing
  public testLoad(): Promise<void> {
    return this.load()
  }

  // Expose protected getPluginApi method for testing
  public testGetPluginApi(plugin: Plugin): PluginApi {
    return this.getPluginApi(plugin)
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
      fn: jest.fn() as MaybePromiseFunction,
      ...hookData,
    },
    plugin,
    key: 'testHook',
    fn: jest.fn() as MaybePromiseFunction,
    ...hookData,
  } as Hook
}

describe('可插拔系统', () => {
  let mockCwd: string
  let pluggable: TestablePluggable

  beforeEach(() => {
    mockCwd = createTempDir()
    jest.clearAllMocks()
  })

  describe('构造函数', () => {
    it('应该创建有效选项的可插拔实例', () => {
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

    it('应该处理缺失的可选属性', () => {
      const minimalOptions: PluggableOptions = { cwd: mockCwd }
      pluggable = new TestablePluggable(minimalOptions)

      expect(pluggable.constructorOptions.presets).toBeUndefined()
      expect(pluggable.constructorOptions.plugins).toBeUndefined()
    })
  })

  describe('执行插件 - 类型推断', () => {
    beforeEach(() => {
      pluggable = new TestablePluggable({ cwd: mockCwd })
      // Set state to loaded to allow applyPlugins
      pluggable.setStateForTesting(PluggableStateEnum.Loaded)
    })

    it('应该从"on"前缀推断事件类型', async () => {
      pluggable.hooks['onStart'] = []

      const result = await pluggable.applyPlugins('onStart')

      expect(result).toBe(0) // tapable returns 0 for event hooks
    })

    it('应该从"get"前缀推断获取类型', async () => {
      pluggable.hooks['getConfig'] = []

      const result = await pluggable.applyPlugins('getConfig')

      expect(result).toBeUndefined() // AsyncSeriesBailHook returns undefined when no results
    })

    it('应该从"modify"前缀推断修改类型', async () => {
      pluggable.hooks['modifyConfig'] = []

      const result = await (pluggable as PluggableWithInternals).applyPlugins(
        'modifyConfig',
        {
          initialValue: { test: true },
        },
      )

      expect(result).toEqual({ test: true })
    })

    it('应该从"add"前缀推断添加类型', async () => {
      pluggable.hooks['addPlugins'] = []

      const result = await pluggable.applyPlugins('addPlugins')

      expect(result).toEqual([])
    })

    it('应该对没有类型的模糊键抛出错误', async () => {
      await expect(pluggable.applyPlugins('ambiguousKey')).rejects.toThrow(
        'Invalid applyPlugins arguments, `type` must be supplied for key `ambiguousKey`.',
      )
    })

    it('应该对无效类型抛出错误', async () => {
      await expect(
        pluggable.applyPlugins('testKey', {
          type: 'invalid' as unknown as ApplyPluginTypeEnum,
        }),
      ).rejects.toThrow(
        'ApplyPlugins failed, `type` not defined or matched, got `invalid`.',
      )
    })
  })

  describe('插件是否启用', () => {
    beforeEach(() => {
      pluggable = new TestablePluggable({ cwd: mockCwd })
    })

    it('应该对启用的插件钩子返回true', () => {
      const hook = createTestHook(mockCwd, {
        id: 'test-plugin',
        enable: () => true,
      })

      const result = pluggable.testIsPluginEnable(hook)

      expect(result).toBe(true)
    })

    it('应该对禁用的插件钩子返回false', () => {
      const hook = createTestHook(mockCwd, {
        id: 'test-plugin',
        enable: () => false,
      })

      const result = pluggable.testIsPluginEnable(hook)

      expect(result).toBe(false)
    })

    it('应该对跳过的插件返回false', () => {
      const hook = createTestHook(mockCwd, {
        id: 'skipped-plugin',
        enable: () => true,
      })

      pluggable.skippedPluginIds.add('skipped-plugin')

      const result = pluggable.testIsPluginEnable(hook)

      expect(result).toBe(false)
    })

    it('应该处理插件键字符串参数', () => {
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

    it('应该处理函数启用条件', () => {
      const enableFn = jest.fn().mockReturnValue(false)
      const hook = createTestHook(mockCwd, {
        id: 'test-plugin',
        enable: enableFn as unknown as () => boolean,
      })

      const result = pluggable.testIsPluginEnable(hook)

      expect(result).toBe(false)
      expect(enableFn).toHaveBeenCalled()
    })
  })

  describe('基础钩子执行', () => {
    beforeEach(() => {
      pluggable = new TestablePluggable({ cwd: mockCwd })
      pluggable.setStateForTesting(PluggableStateEnum.Loaded)
    })

    it('应该正确执行添加钩子', async () => {
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

      const result = await (pluggable as PluggableWithInternals).applyPlugins(
        'addItems',
        {
          type: ApplyPluginTypeEnum.Add,
          initialValue: ['initial'],
        },
      )

      expect(result).toEqual(['initial', 'item1'])
      expect(mockFn).toHaveBeenCalled()
    })

    it('应该正确执行修改钩子', async () => {
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

      const result = await (pluggable as PluggableWithInternals).applyPlugins(
        'modifyConfig',
        {
          type: ApplyPluginTypeEnum.Modify,
          initialValue: { original: true },
        },
      )

      expect(result).toEqual({ modified: true })
      expect(mockFn).toHaveBeenCalledWith({ original: true }, undefined)
    })

    it('应该在钩子执行中跳过禁用的插件', async () => {
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

      const result = await (pluggable as PluggableWithInternals).applyPlugins(
        'addItems',
        {
          type: ApplyPluginTypeEnum.Add,
          initialValue: [],
        },
      )

      expect(result).toEqual(['enabled'])
      expect(enabledFn).toHaveBeenCalled()
      expect(disabledFn).not.toHaveBeenCalled()
    })

    it('应该跟踪钩子执行性能', async () => {
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

      const result = await (pluggable as PluggableWithInternals).applyPlugins(
        'addItems',
        {
          type: ApplyPluginTypeEnum.Add,
          initialValue: [],
        },
      )

      expect(result).toEqual(['result'])
      expect(mockFn).toHaveBeenCalled()
      expect(mockPlugin.time.hooks['addItems']).toBeDefined()
      expect(mockPlugin.time.hooks['addItems']).toHaveLength(1)
      expect(typeof mockPlugin.time.hooks['addItems'][0]).toBe('number')
      expect(mockPlugin.time.hooks['addItems'][0]).toBeGreaterThanOrEqual(0)
    })
  })

  describe('加载功能', () => {
    beforeEach(() => {
      pluggable = new TestablePluggable({ cwd: mockCwd })
      // Mock Plugin.getPresetsAndPlugins to return empty results
      jest.spyOn(Plugin, 'getPresetsAndPlugins').mockReturnValue({
        plugins: [],
        presets: [],
      })
    })

    it('应该成功加载空的预设和插件', async () => {
      await pluggable.testLoad()

      expect(pluggable.state).toBe(PluggableStateEnum.Loaded)
      expect(pluggable.userConfig).toEqual({})
      expect(pluggable.configManager).toBeTruthy()
    })

    it('应该处理加载过程中的状态变化', async () => {
      await pluggable.testLoad()

      expect(pluggable.state).toBe(PluggableStateEnum.Loaded)
    })
  })

  describe('获取插件API', () => {
    beforeEach(() => {
      pluggable = new TestablePluggable({ cwd: mockCwd })
    })

    it('应该为插件创建代理API', () => {
      const plugin = createTestPlugin(mockCwd, 'test-plugin')

      const pluginApi = pluggable.testGetPluginApi(plugin)

      expect(pluginApi).toBeTruthy()
      expect(pluginApi.pluggable).toBe(pluggable)
      expect(pluginApi.plugin).toBe(plugin)
    })

    it('应该通过代理访问可插拔属性', () => {
      const plugin = createTestPlugin(mockCwd, 'test-plugin')

      const pluginApi = pluggable.testGetPluginApi(plugin)

      // Just verify the proxy structure exists
      expect(pluginApi.pluggable).toBe(pluggable)
      expect(pluginApi.plugin).toBe(plugin)
    })
  })

  describe('添加类型钩子错误处理', () => {
    beforeEach(() => {
      pluggable = new TestablePluggable({ cwd: mockCwd })
      pluggable.setStateForTesting(PluggableStateEnum.Loaded)
    })

    it('应该对添加类型的无效初始值抛出错误', async () => {
      pluggable.hooks['addItems'] = []

      await expect(
        (pluggable as PluggableWithInternals).applyPlugins('addItems', {
          type: ApplyPluginTypeEnum.Add,
          initialValue: 'not an array',
        }),
      ).rejects.toThrow(
        'ApplyPlugins failed, `options.initialValue` must be an array when `options.type` is add.',
      )
    })
  })

  describe('获取和事件类型钩子', () => {
    beforeEach(() => {
      pluggable = new TestablePluggable({ cwd: mockCwd })
      pluggable.setStateForTesting(PluggableStateEnum.Loaded)
    })

    it('应该正确执行获取钩子', async () => {
      const mockFn = jest.fn().mockResolvedValue('result')
      const plugin = createTestPlugin(mockCwd, 'plugin1', {
        time: { hooks: {} as Record<string, number[]> },
      })
      const hook = {
        fn: mockFn,
        plugin,
        constructorOptions: { plugin, key: 'getConfig', fn: mockFn },
        key: 'getConfig',
      } as Hook
      pluggable.hooks['getConfig'] = [hook]

      const result = await (pluggable as PluggableWithInternals).applyPlugins(
        'getConfig',
        {
          type: ApplyPluginTypeEnum.Get,
          args: { param: 'test' },
        },
      )

      expect(result).toBe('result')
      expect(mockFn).toHaveBeenCalledWith({ param: 'test' })
    })

    it('应该正确执行事件钩子', async () => {
      const mockFn = jest.fn().mockResolvedValue(undefined)
      const plugin = createTestPlugin(mockCwd, 'plugin1', {
        time: { hooks: {} as Record<string, number[]> },
      })
      const hook = {
        fn: mockFn,
        plugin,
        constructorOptions: { plugin, key: 'onStart', fn: mockFn },
        key: 'onStart',
      } as Hook
      pluggable.hooks['onStart'] = [hook]

      const result = await (pluggable as PluggableWithInternals).applyPlugins(
        'onStart',
        {
          type: ApplyPluginTypeEnum.Event,
          args: { eventData: 'test' },
        },
      )

      expect(result).toBe(0)
      expect(mockFn).toHaveBeenCalledWith({ eventData: 'test' })
    })
  })

  describe('插件启用状态检查', () => {
    beforeEach(() => {
      pluggable = new TestablePluggable({ cwd: mockCwd })
    })

    it('应该处理没有启用条件的插件', () => {
      const hook = createTestHook(mockCwd, {
        id: 'test-plugin',
        // 没有设置 enable 属性
      })

      const result = pluggable.testIsPluginEnable(hook)

      expect(result).toBe(true) // 默认应该返回true
    })
  })
})
