import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MaybePromiseFunction } from '@eljs/utils'
import type { ResolvedPlugin } from '../src'
import { Plugin, PluginApi, PluginHostState } from '../src'
import type { PluginApiHostContext } from '../src/plugin/plugin-api'
import { createMockPlugin } from './setup'

interface MockHost extends PluginApiHostContext {
  hooks: Record<string, unknown[]>
  pluginCapabilities: Record<
    string,
    { plugin: Plugin; fn: MaybePromiseFunction }
  >
  hookDisableRequests: Array<{
    requester: Plugin
    targetKeys: readonly string[]
  }>
  state: PluginHostState
  cwd: string
}

describe('插件核心 API', () => {
  let mockHost: MockHost
  let mockPlugin: Plugin
  let pluginApi: PluginApi

  beforeEach(() => {
    mockPlugin = createMockPlugin('test-plugin')

    // Create simplified mock host context
    mockHost = {
      hooks: {},
      pluginCapabilities: {},
      hookDisableRequests: [],
      state: PluginHostState.LoadingPlugins,
      cwd: '/test/cwd',
      registerHook(hook) {
        this.hooks[hook.key] ||= []
        this.hooks[hook.key].push(hook)
      },
      registerPluginCapability(name, plugin, fn) {
        if (this.pluginCapabilities[name]) {
          throw new Error(
            `PluginApi.registerCapability() failed, capability \`${name}\` already exists.`,
          )
        }
        this.pluginCapabilities[name] = { plugin, fn }
      },
      requestPluginHookDisable(requester, targetKeys) {
        this.hookDisableRequests.push({ requester, targetKeys })
      },
      resolvePlugins: vi.fn().mockReturnValue([]),
    }

    pluginApi = new PluginApi(mockHost, mockPlugin)
  })

  describe('构造函数', () => {
    it('应该创建带有宿主上下文和插件的核心 API', () => {
      expect(pluginApi.cwd).toBe(mockHost.cwd)
      expect(pluginApi.plugin).toEqual(mockPlugin.getMetadata())
    })
  })

  describe('描述插件', () => {
    it('应该合并插件选项', () => {
      const options = { key: 'newKey', enable: () => true }

      pluginApi.describe(options)

      expect(mockPlugin.configure).toHaveBeenCalledWith(options)
    })
  })

  describe('注册钩子', () => {
    it('应该注册带有所有选项的钩子', () => {
      const key = 'testHook'
      const fn = vi.fn()
      const options = { stage: 10, before: 'anotherHook' }

      pluginApi.register(key, fn, options)

      expect(mockHost.hooks[key]).toHaveLength(1)
      expect(mockHost.hooks[key][0]).toMatchObject({
        key,
        fn,
        plugin: mockPlugin,
        stage: 10,
        before: 'anotherHook',
      })
    })

    it('应该注册不带选项的钩子', () => {
      const key = 'testHook'
      const fn = vi.fn()

      pluginApi.register(key, fn)

      expect(mockHost.hooks[key]).toHaveLength(1)
      expect(mockHost.hooks[key][0]).toMatchObject({
        key,
        fn,
        plugin: mockPlugin,
      })
    })
  })

  describe('注册方法', () => {
    it('应该注册带有自定义函数的方法', () => {
      const capabilityName = 'customMethod'
      const fn = vi.fn()

      pluginApi.registerCapability(capabilityName, fn)

      expect(mockHost.pluginCapabilities[capabilityName]).toEqual({
        plugin: mockPlugin,
        fn,
      })
    })

    it('应该对重复的方法名抛出错误', () => {
      const capabilityName = 'customMethod'
      mockHost.pluginCapabilities[capabilityName] = {
        plugin: mockPlugin,
        fn: vi.fn(),
      }

      expect(() => {
        pluginApi.registerCapability(capabilityName, vi.fn())
      }).toThrow(
        'PluginApi.registerCapability() failed, capability `customMethod` already exists.',
      )
    })

    it.each(['register', 'cwd'])('应该拒绝保留方法名 %s', name => {
      expect(() => {
        pluginApi.registerCapability(name, vi.fn())
      }).toThrow(
        `PluginApi.registerCapability() failed, capability \`${name}\` conflicts with a reserved Plugin API name.`,
      )
    })

    it('应该拒绝子类扩展占用的方法名', () => {
      const apiWithExtension = new PluginApi(mockHost, mockPlugin, {
        reservedMethodNames: ['logger'],
      })

      expect(() => {
        apiWithExtension.registerCapability('logger', vi.fn())
      }).toThrow(
        'PluginApi.registerCapability() failed, capability `logger` conflicts with a reserved Plugin API name.',
      )
    })

    it('应该拒绝非函数能力实现', () => {
      expect(() => {
        pluginApi.registerCapability(
          'invalid',
          undefined as unknown as MaybePromiseFunction,
        )
      }).toThrow(
        'PluginApi.registerCapability() failed, capability `invalid` must be a function.',
      )
    })

    it.each(['', ' padded '])('应该拒绝无效能力名 %j', name => {
      expect(() => {
        pluginApi.registerCapability(name, vi.fn())
      }).toThrow(
        expect.objectContaining({
          code: 'PLUGIN_HOST_INVALID_OPTIONS',
        }),
      )
    })
  })

  describe('跳过插件', () => {
    it('应该声明跳过指定插件的 Hook', () => {
      const keysToSkip = ['plugin-1', 'plugin-2']

      pluginApi.disablePluginHooks(keysToSkip)

      expect(mockHost.hookDisableRequests).toEqual([
        { requester: mockPlugin, targetKeys: keysToSkip },
      ])
    })

    it.each([{ keys: [''] }, { keys: [' padded '] }])(
      '应该拒绝无效的 Hook 禁用列表 %#',
      ({ keys }) => {
        expect(() => pluginApi.disablePluginHooks(keys)).toThrow(
          expect.objectContaining({
            code: 'PLUGIN_HOST_INVALID_OPTIONS',
          }),
        )
      },
    )
  })

  describe('注册预设和插件', () => {
    let mockRemainingPresets: ResolvedPlugin[]
    let mockRemainingPlugins: ResolvedPlugin[]

    beforeEach(() => {
      mockRemainingPresets = []
      mockRemainingPlugins = []

      pluginApi = new PluginApi(mockHost, mockPlugin, {
        remainingPlugins: mockRemainingPlugins,
        remainingPresets: mockRemainingPresets,
      })
    })

    it('应该在初始化预设阶段注册预设', () => {
      mockHost.state = PluginHostState.LoadingPresets
      const presets = ['preset1', 'preset2']
      const resolvedPreset: ResolvedPlugin = [
        createMockPlugin('resolved-preset'),
        undefined,
      ]
      vi.mocked(mockHost.resolvePlugins).mockReturnValueOnce([resolvedPreset])

      pluginApi.registerPresets(presets)

      expect(mockHost.resolvePlugins).toHaveBeenCalledWith(
        presets,
        'preset',
        expect.objectContaining({ source: 'plugin-api' }),
      )
      expect(mockRemainingPresets).toEqual([resolvedPreset])
    })

    it('应该在预设初始化期间注册插件', () => {
      mockHost.state = PluginHostState.LoadingPresets
      const plugins = ['plugin1', 'plugin2']
      const resolvedPlugin: ResolvedPlugin = [
        createMockPlugin('resolved-plugin'),
        undefined,
      ]
      vi.mocked(mockHost.resolvePlugins).mockReturnValueOnce([resolvedPlugin])

      pluginApi.registerPlugins(plugins)

      expect(mockHost.resolvePlugins).toHaveBeenCalledWith(
        plugins,
        'plugin',
        expect.objectContaining({ source: 'plugin-api' }),
      )
      expect(mockRemainingPlugins).toEqual([resolvedPlugin])
    })

    it('应该在插件初始化期间注册插件', () => {
      mockHost.state = PluginHostState.LoadingPlugins
      const plugins = ['plugin1', 'plugin2']

      pluginApi.registerPlugins(plugins)

      expect(mockHost.resolvePlugins).toHaveBeenCalledWith(
        plugins,
        'plugin',
        expect.objectContaining({ source: 'plugin-api' }),
      )
    })

    it('应该对在错误状态下注册预设抛出错误', () => {
      mockHost.state = PluginHostState.Ready

      expect(() => {
        pluginApi.registerPresets(['preset'])
      }).toThrow(
        'PluginApi.registerPresets() can only be called while PluginHost is loading presets.',
      )
    })

    it('应该对在错误状态下注册插件抛出错误', () => {
      mockHost.state = PluginHostState.Ready

      expect(() => {
        pluginApi.registerPlugins(['plugin'])
      }).toThrow(
        'PluginApi.registerPlugins() can only be called while PluginHost is loading presets or plugins.',
      )
    })
  })
})
