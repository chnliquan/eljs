/* eslint-disable @typescript-eslint/naming-convention */
import type { ResolvedPlugin } from '../src'
import { PluggableStateEnum, Plugin, PluginApi } from '../src'
import { createMockPlugin } from './setup'

interface MockPluggable {
  hooks: Record<string, unknown[]>
  pluginMethods: Record<string, { plugin: Plugin; fn: () => void }>
  key2Plugin: Record<string, Plugin>
  skippedPluginIds: Set<string>
  state: PluggableStateEnum
  cwd: string
}

describe('插件API', () => {
  let mockPluggable: MockPluggable
  let mockPlugin: Plugin
  let pluginApi: PluginApi

  beforeEach(() => {
    mockPlugin = createMockPlugin('test-plugin')

    // Create simplified mock pluggable instance
    mockPluggable = {
      hooks: {},
      pluginMethods: {},
      key2Plugin: {},
      skippedPluginIds: new Set(),
      state: PluggableStateEnum.InitPlugins,
      cwd: '/test/cwd',
    }

    pluginApi = new PluginApi(
      mockPluggable as unknown as ConstructorParameters<typeof PluginApi>[0],
      mockPlugin,
    )
  })

  describe('构造函数', () => {
    it('应该创建带有可插拔实例和插件的插件API', () => {
      expect(pluginApi.pluggable).toBe(mockPluggable)
      expect(pluginApi.plugin).toBe(mockPlugin)
    })
  })

  describe('描述插件', () => {
    it('应该合并插件选项', () => {
      const options = { key: 'newKey', enable: () => true }

      pluginApi.describe(options)

      expect(mockPlugin.merge).toHaveBeenCalledWith(options)
    })
  })

  describe('注册钩子', () => {
    it('应该注册带有所有选项的钩子', () => {
      const key = 'testHook'
      const fn = jest.fn()
      const options = { stage: 10, before: 'anotherHook' }

      pluginApi.register(key, fn, options)

      expect(mockPluggable.hooks[key]).toHaveLength(1)
      expect(mockPluggable.hooks[key][0]).toMatchObject({
        key,
        fn,
        plugin: mockPlugin,
        stage: 10,
        before: 'anotherHook',
      })
    })

    it('应该注册不带选项的钩子', () => {
      const key = 'testHook'
      const fn = jest.fn()

      pluginApi.register(key, fn)

      expect(mockPluggable.hooks[key]).toHaveLength(1)
      expect(mockPluggable.hooks[key][0]).toMatchObject({
        key,
        fn,
        plugin: mockPlugin,
      })
    })
  })

  describe('注册方法', () => {
    it('应该注册带有自定义函数的方法', () => {
      const methodName = 'customMethod'
      const fn = jest.fn()

      pluginApi.registerMethod(methodName, fn)

      expect(mockPluggable.pluginMethods[methodName]).toEqual({
        plugin: mockPlugin,
        fn,
      })
    })

    it('应该对重复的方法名抛出错误', () => {
      const methodName = 'customMethod'
      mockPluggable.pluginMethods[methodName] = {
        plugin: mockPlugin,
        fn: jest.fn(),
      }

      expect(() => {
        pluginApi.registerMethod(methodName, jest.fn())
      }).toThrow(
        'api.registerMethod() failed, method `customMethod` already exist.',
      )
    })
  })

  describe('跳过插件', () => {
    beforeEach(() => {
      mockPluggable.key2Plugin = {
        'plugin-1': createMockPlugin('plugin-1'),
        'plugin-2': createMockPlugin('plugin-2'),
      }
    })

    it('应该跳过指定的插件', () => {
      const keysToSkip = ['plugin-1', 'plugin-2']

      pluginApi.skipPlugins(keysToSkip)

      expect(mockPluggable.skippedPluginIds.has('plugin-1')).toBe(true)
      expect(mockPluggable.skippedPluginIds.has('plugin-2')).toBe(true)
    })

    it('不应该允许插件跳过自己', () => {
      mockPlugin.key = 'test-plugin'

      expect(() => {
        pluginApi.skipPlugins(['test-plugin'])
      }).toThrow('Plugin `test-plugin` could not skip itself.')
    })

    it('应该对不存在的插件抛出错误', () => {
      expect(() => {
        pluginApi.skipPlugins(['non-existent-plugin'])
      }).toThrow(
        '`non-existent-plugin` has not been registered by any plugin, could not be skipped.',
      )
    })
  })

  describe('注册预设和插件', () => {
    let mockRemainingPresets: ResolvedPlugin[]
    let mockRemainingPlugins: ResolvedPlugin[]

    beforeEach(() => {
      mockRemainingPresets = []
      mockRemainingPlugins = []

      // Mock Plugin.resolvePlugins
      jest.spyOn(Plugin, 'resolvePlugins').mockReturnValue([])
    })

    it('应该在初始化预设阶段注册预设', () => {
      mockPluggable.state = PluggableStateEnum.InitPresets
      const presets = ['preset1', 'preset2']

      pluginApi.registerPresets(mockRemainingPresets, presets)

      expect(Plugin.resolvePlugins).toHaveBeenCalledWith(
        presets,
        'preset',
        '/test/cwd',
      )
    })

    it('应该在预设初始化期间注册插件', () => {
      mockPluggable.state = PluggableStateEnum.InitPresets
      const plugins = ['plugin1', 'plugin2']

      pluginApi.registerPlugins(mockRemainingPlugins, plugins)

      expect(Plugin.resolvePlugins).toHaveBeenCalledWith(
        plugins,
        'plugin',
        '/test/cwd',
      )
    })

    it('应该在插件初始化期间注册插件', () => {
      mockPluggable.state = PluggableStateEnum.InitPlugins
      const plugins = ['plugin1', 'plugin2']

      pluginApi.registerPlugins(mockRemainingPlugins, plugins)

      expect(Plugin.resolvePlugins).toHaveBeenCalledWith(
        plugins,
        'plugin',
        '/test/cwd',
      )
    })

    it('应该对在错误状态下注册预设抛出错误', () => {
      mockPluggable.state = PluggableStateEnum.Loaded

      expect(() => {
        pluginApi.registerPresets(mockRemainingPresets, ['preset'])
      }).toThrow(
        'api.registerPresets() failed, it should only be used during the presets state.',
      )
    })

    it('应该对在错误状态下注册插件抛出错误', () => {
      mockPluggable.state = PluggableStateEnum.Loaded

      expect(() => {
        pluginApi.registerPlugins(mockRemainingPlugins, ['plugin'])
      }).toThrow(
        'api.registerPlugins() failed, it should only be used during the registering state.',
      )
    })
  })

  describe('registerMethod不带函数参数', () => {
    it('应该注册没有自定义函数的方法', () => {
      const methodName = 'testMethod'

      pluginApi.registerMethod(methodName)

      expect(mockPluggable.pluginMethods[methodName]).toBeDefined()
      expect(mockPluggable.pluginMethods[methodName].plugin).toBe(mockPlugin)
      expect(typeof mockPluggable.pluginMethods[methodName].fn).toBe('function')
    })
  })
})
