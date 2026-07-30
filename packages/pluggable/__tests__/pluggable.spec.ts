import type { MaybePromiseFunction } from '@eljs/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PluggableErrorCode } from '../src/errors'
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
vi.mock('@eljs/config', () => ({
  ConfigManager: vi.fn().mockImplementation(function ConfigManager() {
    return {
      getConfig: vi.fn().mockResolvedValue({}),
    }
  }),
}))

// Mock utils with simple implementations
vi.mock('@eljs/utils', () => ({
  findUp: {
    sync: vi.fn().mockReturnValue('/mock/package.json'),
  },
  isPathExistsSync: vi.fn().mockReturnValue(true),
  isFunction: vi.fn().mockReturnValue(true),
  winPath: vi.fn().mockImplementation(path => path || 'mocked-path'),
  camelCase: vi.fn().mockImplementation(str => str || 'mockedCase'),
  readJsonSync: vi
    .fn()
    .mockReturnValue({ main: 'index.js', name: 'test-package' }),
  fileLoadersSync: vi.fn().mockReturnValue(() => ({})),
  resolve: vi.fn().mockImplementation(str => str || 'resolved-path'),
}))

// Mock path functions
vi.mock('node:path', () => ({
  basename: vi
    .fn()
    .mockImplementation(path => path?.split('/').pop() || 'mocked-basename'),
  dirname: vi
    .fn()
    .mockImplementation(
      path => path?.split('/').slice(0, -1).join('/') || 'mocked-dirname',
    ),
  extname: vi.fn().mockReturnValue('.js'),
  join: vi
    .fn()
    .mockImplementation((...paths) => paths.join('/') || 'mocked-joined-path'),
  relative: vi
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

  // Expose protected plugin API creation for testing
  public testGetPluginApi(plugin: Plugin): PluginApi {
    return this._getPluginApi(plugin)
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
    time: { hooks: {}, hookErrors: {} },
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
      fn: vi.fn() as MaybePromiseFunction,
      ...hookData,
    },
    plugin,
    key: 'testHook',
    fn: vi.fn() as MaybePromiseFunction,
    ...hookData,
  } as Hook
}

describe('可插拔系统', () => {
  let mockCwd: string
  let pluggable: TestablePluggable

  beforeEach(() => {
    mockCwd = createTempDir()
    vi.clearAllMocks()
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
      expect(pluggable.skippedPluginHookIds).toBeInstanceOf(Set)
    })

    it('应该处理缺失的可选属性', () => {
      const minimalOptions: PluggableOptions = { cwd: mockCwd }
      pluggable = new TestablePluggable(minimalOptions)

      expect(pluggable.constructorOptions.presets).toBeUndefined()
      expect(pluggable.constructorOptions.plugins).toBeUndefined()
    })

    it('加载前不应该执行插件 Hook', async () => {
      pluggable = new TestablePluggable({ cwd: mockCwd })

      await expect(pluggable.applyPlugins('onStart')).rejects.toMatchObject({
        code: PluggableErrorCode.InvalidState,
      })
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

      expect(result).toBeUndefined()
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

    it('应该支持静态 false 启用条件', () => {
      const hook = createTestHook(mockCwd, {
        id: 'test-plugin',
        enable: false,
      })

      expect(pluggable.testIsPluginEnable(hook)).toBe(false)
    })

    it('应该对跳过的插件返回false', () => {
      const hook = createTestHook(mockCwd, {
        id: 'skipped-plugin',
        enable: () => true,
      })

      pluggable.skippedPluginHookIds.add('skipped-plugin')

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
      const enableFn = vi.fn().mockReturnValue(false)
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
      const mockFn = vi.fn().mockResolvedValue(['item1'])
      const plugin = createTestPlugin(mockCwd, 'plugin1', {
        time: {
          hooks: {} as Record<string, number[]>,
          hookErrors: {},
        },
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
      const mockFn = vi.fn().mockResolvedValue({ modified: true })
      const plugin = createTestPlugin(mockCwd, 'plugin1', {
        time: {
          hooks: {} as Record<string, number[]>,
          hookErrors: {},
        },
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
      const enabledFn = vi.fn().mockResolvedValue(['enabled'])
      const disabledFn = vi.fn().mockResolvedValue(['disabled'])

      const enabledPlugin = createTestPlugin(mockCwd, 'enabled-plugin', {
        time: {
          hooks: {} as Record<string, number[]>,
          hookErrors: {},
        },
        enable: () => true,
      })
      const disabledPlugin = createTestPlugin(mockCwd, 'disabled-plugin', {
        time: {
          hooks: {} as Record<string, number[]>,
          hookErrors: {},
        },
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
      const mockFn = vi.fn().mockResolvedValue(['result'])
      const mockPlugin = createTestPlugin(mockCwd, 'test-plugin', {
        time: {
          hooks: {} as Record<string, number[]>,
          hookErrors: {},
        },
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

    it('应该限制每个 Hook 保留的耗时样本数量', async () => {
      const mockFn = vi.fn().mockResolvedValue([])
      const mockPlugin = createTestPlugin(mockCwd, 'test-plugin', {
        time: {
          hooks: {},
          hookErrors: {},
        },
      })
      const hook = {
        fn: mockFn,
        plugin: mockPlugin,
        constructorOptions: { plugin: mockPlugin, key: 'addItems', fn: mockFn },
        key: 'addItems',
      } as Hook
      pluggable.hooks['addItems'] = [hook]

      for (let index = 0; index < 25; index += 1) {
        await pluggable.applyPlugins('addItems', {
          type: ApplyPluginTypeEnum.Add,
          initialValue: [],
        })
      }

      expect(mockPlugin.time.hooks['addItems']).toHaveLength(20)
    })

    it('应该记录失败 Hook 的耗时和错误次数', async () => {
      const error = new Error('hook failed')
      const mockFn = vi.fn().mockRejectedValue(error)
      const mockPlugin = createTestPlugin(mockCwd, 'test-plugin', {
        time: {
          hooks: {},
          hookErrors: {},
        },
      })
      const hook = {
        fn: mockFn,
        plugin: mockPlugin,
        constructorOptions: { plugin: mockPlugin, key: 'onFail', fn: mockFn },
        key: 'onFail',
      } as Hook
      pluggable.hooks['onFail'] = [hook]

      await expect(
        pluggable.applyPlugins('onFail', {
          type: ApplyPluginTypeEnum.Event,
        }),
      ).rejects.toBe(error)

      expect(mockPlugin.time.hooks['onFail']).toHaveLength(1)
      expect(mockPlugin.time.hookErrors['onFail']).toBe(1)
    })
  })

  describe('加载功能', () => {
    beforeEach(() => {
      pluggable = new TestablePluggable({ cwd: mockCwd })
      // Mock Plugin.getPresetsAndPlugins to return empty results
      vi.spyOn(Plugin, 'getPresetsAndPlugins').mockReturnValue({
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

    it('应该拒绝第二次加载', async () => {
      await pluggable.testLoad()

      await expect(pluggable.testLoad()).rejects.toMatchObject({
        code: PluggableErrorCode.InvalidState,
      })
      expect(pluggable.state).toBe(PluggableStateEnum.Loaded)
    })

    it('加载失败后应该清理注册数据并进入失败终态', async () => {
      const brokenPlugin = createTestPlugin(mockCwd, 'broken-plugin')
      brokenPlugin.apply = vi.fn(() => (api: PluginApi) => {
        api.register('onBroken', vi.fn())
        api.registerMethod('brokenMethod', vi.fn())
        throw new Error('plugin failed')
      }) as Plugin['apply']
      vi.mocked(Plugin.getPresetsAndPlugins).mockReturnValue({
        presets: [],
        plugins: [[brokenPlugin, undefined]],
      })

      await expect(pluggable.testLoad()).rejects.toThrow('plugin failed')

      expect(pluggable.state).toBe(PluggableStateEnum.Failed)
      expect(pluggable.configManager).toBeNull()
      expect(pluggable.userConfig).toBeNull()
      expect(pluggable.plugins).toEqual({})
      expect(pluggable.key2Plugin).toEqual({})
      expect(pluggable.hooks).toEqual({})
      expect(pluggable.pluginMethods).toEqual({})

      await expect(pluggable.testLoad()).rejects.toMatchObject({
        code: PluggableErrorCode.InvalidState,
      })
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

    it('应该拒绝覆盖核心 Plugin API 的扩展', () => {
      class ConflictingPluggable extends TestablePluggable {
        protected override extendPluginApi() {
          return {
            register: vi.fn(),
          }
        }
      }

      const conflictingPluggable = new ConflictingPluggable({ cwd: mockCwd })
      const plugin = createTestPlugin(mockCwd, 'test-plugin')

      expect(() => conflictingPluggable.testGetPluginApi(plugin)).toThrow(
        'extendPluginApi() failed, property `register` conflicts with a reserved Plugin API name.',
      )
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
      const mockFn = vi.fn().mockResolvedValue('result')
      const plugin = createTestPlugin(mockCwd, 'plugin1', {
        time: {
          hooks: {} as Record<string, number[]>,
          hookErrors: {},
        },
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

    it('获取钩子应该跳过 null 并返回第一个非空结果', async () => {
      const firstFn = vi.fn().mockResolvedValue(null)
      const secondFn = vi.fn().mockResolvedValue('result')
      const firstPlugin = createTestPlugin(mockCwd, 'plugin1', {
        time: { hooks: {}, hookErrors: {} },
      })
      const secondPlugin = createTestPlugin(mockCwd, 'plugin2', {
        time: { hooks: {}, hookErrors: {} },
      })
      pluggable.hooks['getConfig'] = [
        {
          fn: firstFn,
          plugin: firstPlugin,
          constructorOptions: {
            plugin: firstPlugin,
            key: 'getConfig',
            fn: firstFn,
          },
          key: 'getConfig',
        } as Hook,
        {
          fn: secondFn,
          plugin: secondPlugin,
          constructorOptions: {
            plugin: secondPlugin,
            key: 'getConfig',
            fn: secondFn,
          },
          key: 'getConfig',
        } as Hook,
      ]

      const result = await pluggable.applyPlugins('getConfig', {
        type: ApplyPluginTypeEnum.Get,
      })

      expect(result).toBe('result')
      expect(firstFn).toHaveBeenCalledOnce()
      expect(secondFn).toHaveBeenCalledOnce()
    })

    it('应该正确执行事件钩子', async () => {
      const mockFn = vi.fn().mockResolvedValue(undefined)
      const plugin = createTestPlugin(mockCwd, 'plugin1', {
        time: {
          hooks: {} as Record<string, number[]>,
          hookErrors: {},
        },
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

      expect(result).toBeUndefined()
      expect(mockFn).toHaveBeenCalledWith({ eventData: 'test' })
    })
  })

  describe('插件调试信息', () => {
    it('应该返回不会修改内部统计的快照', () => {
      pluggable = new TestablePluggable({ cwd: mockCwd })
      const plugin = createTestPlugin(mockCwd, 'plugin1', {
        time: {
          register: 1,
          hooks: { onStart: [2] },
          hookErrors: { onStart: 1 },
        },
      })
      pluggable.plugins[plugin.id] = plugin

      const diagnostics = pluggable.getPluginDiagnostics()
      diagnostics[0].time.hooks['onStart'].push(3)

      expect(diagnostics[0]).toMatchObject({
        id: 'plugin1',
        time: {
          register: 1,
          hookErrors: { onStart: 1 },
        },
      })
      expect(plugin.time.hooks['onStart']).toEqual([2])
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
