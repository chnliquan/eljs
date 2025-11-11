/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PluggableStateEnum, PluginApi } from '../src'
import { createMockPlugin } from './setup'

describe('PluginApi', () => {
  let mockPluggable: any
  let mockPlugin: any
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

    pluginApi = new PluginApi(mockPluggable, mockPlugin)
  })

  describe('constructor', () => {
    it('should create PluginApi with pluggable and plugin', () => {
      expect(pluginApi.pluggable).toBe(mockPluggable)
      expect(pluginApi.plugin).toBe(mockPlugin)
    })
  })

  describe('describe', () => {
    it('should merge plugin options', () => {
      const options = { key: 'newKey', enable: () => true }

      pluginApi.describe(options)

      expect(mockPlugin.merge).toHaveBeenCalledWith(options)
    })
  })

  describe('register', () => {
    it('should register hook with all options', () => {
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

    it('should register hook without options', () => {
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

  describe('registerMethod', () => {
    it('should register method with custom function', () => {
      const methodName = 'customMethod'
      const fn = jest.fn()

      pluginApi.registerMethod(methodName, fn)

      expect(mockPluggable.pluginMethods[methodName]).toEqual({
        plugin: mockPlugin,
        fn,
      })
    })

    it('should throw error for duplicate method name', () => {
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

  describe('skipPlugins', () => {
    beforeEach(() => {
      mockPluggable.key2Plugin = {
        'plugin-1': createMockPlugin('plugin-1'),
        'plugin-2': createMockPlugin('plugin-2'),
      }
    })

    it('should skip specified plugins', () => {
      const keysToSkip = ['plugin-1', 'plugin-2']

      pluginApi.skipPlugins(keysToSkip)

      expect(mockPluggable.skippedPluginIds.has('plugin-1')).toBe(true)
      expect(mockPluggable.skippedPluginIds.has('plugin-2')).toBe(true)
    })

    it('should not allow plugin to skip itself', () => {
      mockPlugin.key = 'test-plugin'

      expect(() => {
        pluginApi.skipPlugins(['test-plugin'])
      }).toThrow('Plugin `test-plugin` could not skip itself.')
    })

    it('should throw error for non-existent plugin', () => {
      expect(() => {
        pluginApi.skipPlugins(['non-existent-plugin'])
      }).toThrow(
        '`non-existent-plugin` has not been registered by any plugin, could not be skipped.',
      )
    })
  })
})
