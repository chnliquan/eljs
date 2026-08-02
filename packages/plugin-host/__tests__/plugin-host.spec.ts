import type { MaybePromiseFunction } from '@eljs/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { PluginContext } from '../src/core/plugin-host'
import { PluginHost } from '../src/core/plugin-host'
import type { PluginHostOptions } from '../src/core/types'
import { HookKind, PluginHostState } from '../src/core/types'
import { PluginHostErrorCode } from '../src/errors'
import { definePlugin } from '../src/plugin/define'
import type { Hook } from '../src/plugin/hook'
import type { LooseHookSchema } from '../src/plugin/hook-schema'
import { Plugin } from '../src/plugin/plugin'
import * as pluginResolver from '../src/plugin/plugin-resolver'
import type { HookRegistry } from '../src/runtime/hook-registry'
import type { PluginRegistry } from '../src/runtime/plugin-registry'
import {
  createMockPlugin,
  createTempDir,
  type MockPluginOptions,
} from './setup'

// Type helper for accessing internal host methods
interface PluginHostWithInternals {
  runHook: (
    key: string,
    options?: {
      kind?: HookKind
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
vi.mock('@eljs/utils/file', async () => import('@eljs/utils'))
vi.mock('@eljs/utils', () => ({
  findUp: {
    sync: vi.fn().mockReturnValue('/mock/package.json'),
  },
  isDirectorySync: vi.fn().mockReturnValue(true),
  pathExistsSync: vi.fn().mockReturnValue(true),
  isFunction: vi.fn().mockReturnValue(true),
  toPosixPath: vi.fn().mockImplementation(path => path || 'mocked-path'),
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
  isAbsolute: vi.fn().mockReturnValue(false),
  join: vi
    .fn()
    .mockImplementation((...paths) => paths.join('/') || 'mocked-joined-path'),
  relative: vi
    .fn()
    .mockImplementation((from, to) => to || 'mocked-relative-path'),
  resolve: vi.fn().mockImplementation(path => path),
}))

// Create a testable subclass to access protected methods
class TestablePluginHost extends PluginHost {
  // Expose protected method for testing
  public testIsPluginEnable(hook: Hook | string): boolean {
    return this.isPluginHookEnabled(hook)
  }

  // Provide a way to set state for testing
  public setStateForTesting(state: PluginHostState): void {
    // Use bracket notation to access private property
    ;(this as unknown as { _state: PluginHostState })._state = state
  }

  // Expose protected load method for testing
  public testLoad(): Promise<void> {
    return this.load()
  }

  // Expose protected plugin API creation for testing
  public testCreatePluginContext(
    plugin: Plugin,
  ): PluginContext<LooseHookSchema> {
    return (
      this as unknown as {
        _createPluginContext(plugin: Plugin): PluginContext<LooseHookSchema>
      }
    )._createPluginContext(plugin)
  }

  public testRegisterHooks(...hooks: Hook[]): void {
    const registry = (
      this as unknown as {
        _hooks: HookRegistry
      }
    )._hooks
    hooks.forEach(hook => registry.register(hook))
  }

  public testRegisterPlugin(plugin: Plugin): void {
    const registry = (
      this as unknown as {
        _plugins: PluginRegistry
      }
    )._plugins
    registry.reserve(plugin)
    registry.complete(plugin)
  }

  public testSkipPluginHooks(requester: Plugin, keys: string[]): void {
    const registry = (
      this as unknown as {
        _plugins: PluginRegistry
      }
    )._plugins
    registry.requestHookDisable(requester, keys)
    registry.resolveHookDisables()
  }

  public testHookCount(key: string): number {
    return (
      this as unknown as {
        _hooks: HookRegistry
      }
    )._hooks.get(key).length
  }

  public testHasPluginCapability(name: string): boolean {
    return (
      this as unknown as {
        _plugins: PluginRegistry
      }
    )._plugins.hasCapability(name)
  }

  public get testUserConfig() {
    return this.userConfig
  }
}

// Helper function to create test plugin
function createTestPlugin(
  _cwd: string,
  id: string,
  overrides: MockPluginOptions = {},
): Plugin {
  return createMockPlugin(id, overrides)
}

// Helper function to create test hook
function createTestHook(
  cwd: string,
  pluginData: MockPluginOptions = {},
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

describe('插件宿主', () => {
  let mockCwd: string
  let host: TestablePluginHost

  beforeEach(() => {
    mockCwd = createTempDir()
    vi.clearAllMocks()
  })

  describe('构造函数', () => {
    it('应该使用有效选项创建插件宿主', () => {
      const options: PluginHostOptions = {
        cwd: mockCwd,
        presets: [],
        plugins: [],
        defaultConfigFiles: ['config.js'],
      }

      host = new TestablePluginHost(options)

      expect(host.constructorOptions).toEqual(options)
      expect(host.cwd).toBe(mockCwd)
      expect(host.state).toBe(PluginHostState.Uninitialized)
    })

    it('应该处理缺失的可选属性', () => {
      const minimalOptions: PluginHostOptions = { cwd: mockCwd }
      host = new TestablePluginHost(minimalOptions)

      expect(host.constructorOptions.presets).toBeUndefined()
      expect(host.constructorOptions.plugins).toBeUndefined()
    })

    it('加载前不应该执行插件 Hook', async () => {
      host = new TestablePluginHost({ cwd: mockCwd })

      await expect(host.runHook('onStart')).rejects.toMatchObject({
        code: PluginHostErrorCode.InvalidState,
      })
    })
  })

  describe('执行插件 - 类型推断', () => {
    beforeEach(() => {
      host = new TestablePluginHost({ cwd: mockCwd })
      // Set state to ready to allow runHook
      host.setStateForTesting(PluginHostState.Ready)
    })

    it('应该从"on"前缀推断事件类型', async () => {
      const result = await host.runHook('onStart')

      expect(result).toBeUndefined()
    })

    it('应该从"get"前缀推断获取类型', async () => {
      const result = await host.runHook('getConfig')

      expect(result).toBeUndefined() // AsyncSeriesBailHook returns undefined when no results
    })

    it('应该从"modify"前缀推断修改类型', async () => {
      const result = await (host as PluginHostWithInternals).runHook(
        'modifyConfig',
        {
          initialValue: { test: true },
        },
      )

      expect(result).toEqual({ test: true })
    })

    it('应该从"add"前缀推断添加类型', async () => {
      const result = await host.runHook('addPlugins')

      expect(result).toEqual([])
    })

    it('应该对没有类型的模糊键抛出错误', async () => {
      await expect(host.runHook('ambiguousKey')).rejects.toThrow(
        'Invalid runHook() arguments, `kind` must be supplied for key `ambiguousKey`.',
      )
    })

    it('应该对无效类型抛出错误', async () => {
      await expect(
        host.runHook('testKey', {
          kind: 'invalid' as unknown as HookKind,
        }),
      ).rejects.toThrow(
        'Run hook `testKey` failed, kind is missing or invalid: `invalid`.',
      )
    })
  })

  describe('插件是否启用', () => {
    beforeEach(() => {
      host = new TestablePluginHost({ cwd: mockCwd })
    })

    it('应该对启用的插件钩子返回true', () => {
      const hook = createTestHook(mockCwd, {
        id: 'test-plugin',
        enable: () => true,
      })

      const result = host.testIsPluginEnable(hook)

      expect(result).toBe(true)
    })

    it('应该对禁用的插件钩子返回false', () => {
      const hook = createTestHook(mockCwd, {
        id: 'test-plugin',
        enable: () => false,
      })

      const result = host.testIsPluginEnable(hook)

      expect(result).toBe(false)
    })

    it('应该支持静态 false 启用条件', () => {
      const hook = createTestHook(mockCwd, {
        id: 'test-plugin',
        enable: false,
      })

      expect(host.testIsPluginEnable(hook)).toBe(false)
    })

    it('应该对跳过的插件返回false', () => {
      const hook = createTestHook(mockCwd, {
        id: 'skipped-plugin',
        key: 'skipped-plugin',
        enable: () => true,
      })

      const requester = createTestPlugin(mockCwd, 'requester')
      host.testRegisterPlugin(hook.plugin)
      host.testSkipPluginHooks(requester, ['skipped-plugin'])

      const result = host.testIsPluginEnable(hook)

      expect(result).toBe(false)
    })

    it('应该处理插件键字符串参数', () => {
      host.testRegisterPlugin(
        createTestPlugin(mockCwd, 'test-plugin-id', {
          key: 'test-plugin',
          enable: () => true,
        }),
      )

      const result = host.testIsPluginEnable('test-plugin')

      expect(result).toBe(true)
    })

    it('应该处理函数启用条件', () => {
      const enableFn = vi.fn().mockReturnValue(false)
      const hook = createTestHook(mockCwd, {
        id: 'test-plugin',
        enable: enableFn as unknown as () => boolean,
      })

      const result = host.testIsPluginEnable(hook)

      expect(result).toBe(false)
      expect(enableFn).toHaveBeenCalled()
    })
  })

  describe('基础钩子执行', () => {
    beforeEach(() => {
      host = new TestablePluginHost({ cwd: mockCwd })
      host.setStateForTesting(PluginHostState.Ready)
    })

    it('应该正确执行添加钩子', async () => {
      const mockFn = vi.fn().mockResolvedValue(['item1'])
      const plugin = createTestPlugin(mockCwd, 'plugin1')
      const hook = {
        fn: mockFn,
        plugin,
        constructorOptions: { plugin, key: 'addItems', fn: mockFn },
        key: 'addItems',
      } as Hook
      host.testRegisterHooks(hook)

      const result = await (host as PluginHostWithInternals).runHook(
        'addItems',
        {
          kind: HookKind.Add,
          initialValue: ['initial'],
        },
      )

      expect(result).toEqual(['initial', 'item1'])
      expect(mockFn).toHaveBeenCalled()
    })

    it('应该正确执行修改钩子', async () => {
      const mockFn = vi.fn().mockResolvedValue({ modified: true })
      const plugin = createTestPlugin(mockCwd, 'plugin1')
      const hook = {
        fn: mockFn,
        plugin,
        constructorOptions: { plugin, key: 'modifyConfig', fn: mockFn },
        key: 'modifyConfig',
      } as Hook
      host.testRegisterHooks(hook)

      const result = await (host as PluginHostWithInternals).runHook(
        'modifyConfig',
        {
          kind: HookKind.Modify,
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
        enable: () => true,
      })
      const disabledPlugin = createTestPlugin(mockCwd, 'disabled-plugin', {
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

      host.testRegisterHooks(enabledHook, disabledHook)

      const result = await (host as PluginHostWithInternals).runHook(
        'addItems',
        {
          kind: HookKind.Add,
          initialValue: [],
        },
      )

      expect(result).toEqual(['enabled'])
      expect(enabledFn).toHaveBeenCalled()
      expect(disabledFn).not.toHaveBeenCalled()
    })
  })

  describe('加载功能', () => {
    beforeEach(() => {
      host = new TestablePluginHost({ cwd: mockCwd })
      // Mock resolvePresetsAndPlugins to return empty results
      vi.spyOn(pluginResolver, 'resolvePresetsAndPlugins').mockReturnValue({
        plugins: [],
        presets: [],
      })
    })

    it('应该成功加载空的预设和插件', async () => {
      await host.testLoad()

      expect(host.state).toBe(PluginHostState.Ready)
      expect(host.testUserConfig).toEqual({})
    })

    it('应该处理加载过程中的状态变化', async () => {
      await host.testLoad()

      expect(host.state).toBe(PluginHostState.Ready)
    })

    it('应该使用 Zod 在初始化前解析参数并传入 Schema 输出', async () => {
      const initialize = vi.fn()
      definePlugin({
        optionsSchema: z.object({
          count: z.string().transform(Number),
          enabled: z.boolean().default(true),
        }),
        initialize,
      })
      const plugin = createTestPlugin(mockCwd, 'schema-plugin', {
        initializer: initialize,
      })
      vi.mocked(pluginResolver.resolvePresetsAndPlugins).mockReturnValue({
        presets: [],
        plugins: [[plugin, { count: '2' }]],
      })

      await host.testLoad()

      expect(initialize).toHaveBeenCalledWith(expect.any(Object), {
        count: 2,
        enabled: true,
      })
    })

    it('Zod 参数校验失败时应该阻止初始化并保留结构化问题', async () => {
      const initialize = vi.fn()
      definePlugin({
        optionsSchema: z.object({ count: z.number() }),
        initialize,
      })
      const plugin = createTestPlugin(mockCwd, 'invalid-options-plugin', {
        initializer: initialize,
      })
      vi.mocked(pluginResolver.resolvePresetsAndPlugins).mockReturnValue({
        presets: [],
        plugins: [[plugin, { count: 'invalid' }]],
      })

      await expect(host.testLoad()).rejects.toMatchObject({
        code: PluginHostErrorCode.InvalidPluginOptions,
        details: {
          issues: [
            {
              path: ['count'],
            },
          ],
          pluginId: 'invalid-options-plugin',
        },
        message: expect.stringContaining('options.count:'),
      })
      expect(initialize).not.toHaveBeenCalled()
      expect(host.state).toBe(PluginHostState.Failed)
    })

    it('应该拒绝省略必填的插件参数', async () => {
      const initialize = vi.fn()
      definePlugin({
        optionsSchema: z.object({ count: z.number() }),
        initialize,
      })
      const plugin = createTestPlugin(mockCwd, 'required-options-plugin', {
        initializer: initialize,
      })
      vi.mocked(pluginResolver.resolvePresetsAndPlugins).mockReturnValue({
        presets: [],
        plugins: [[plugin, undefined]],
      })

      await expect(host.testLoad()).rejects.toMatchObject({
        code: PluginHostErrorCode.InvalidPluginOptions,
        details: {
          issues: [{ path: [] }],
          pluginId: 'required-options-plugin',
        },
      })
      expect(initialize).not.toHaveBeenCalled()
      expect(host.state).toBe(PluginHostState.Failed)
    })

    it('校验器异常时应该保留 cause 并阻止初始化', async () => {
      const validationError = new Error('schema crashed')
      const initialize = vi.fn()
      const validate = vi.fn().mockRejectedValue(validationError)
      definePlugin({
        optionsSchema: {
          '~standard': {
            validate,
            vendor: 'test',
            version: 1,
          },
        },
        initialize,
      })
      const plugin = createTestPlugin(mockCwd, 'throwing-schema-plugin', {
        initializer: initialize,
      })
      vi.mocked(pluginResolver.resolvePresetsAndPlugins).mockReturnValue({
        presets: [],
        plugins: [[plugin, { count: 1 }]],
      })

      await expect(host.testLoad()).rejects.toMatchObject({
        cause: validationError,
        code: PluginHostErrorCode.InvalidPluginOptions,
        details: {
          pluginId: 'throwing-schema-plugin',
        },
        message: expect.stringContaining('schema crashed'),
      })
      expect(validate).toHaveBeenCalledWith({ count: 1 })
      expect(initialize).not.toHaveBeenCalled()
      expect(host.state).toBe(PluginHostState.Failed)
    })

    it('应该拒绝第二次加载', async () => {
      await host.testLoad()

      await expect(host.testLoad()).rejects.toMatchObject({
        code: PluginHostErrorCode.InvalidState,
      })
      expect(host.state).toBe(PluginHostState.Ready)
    })

    it('加载失败后应该清理注册数据并进入失败终态', async () => {
      const brokenPlugin = createTestPlugin(mockCwd, 'broken-plugin', {
        initializer: context => {
          context.register('onBroken', vi.fn())
          context.registerCapability('brokenMethod', vi.fn())
          throw new Error('plugin failed')
        },
      })
      vi.mocked(pluginResolver.resolvePresetsAndPlugins).mockReturnValue({
        presets: [],
        plugins: [[brokenPlugin, undefined]],
      })

      await expect(host.testLoad()).rejects.toThrow('plugin failed')

      expect(host.state).toBe(PluginHostState.Failed)
      expect(host.testUserConfig).toBeNull()
      expect(host.testHookCount('onBroken')).toBe(0)
      expect(host.testHasPluginCapability('brokenMethod')).toBe(false)

      await expect(host.testLoad()).rejects.toMatchObject({
        code: PluginHostErrorCode.InvalidState,
      })
    })

    it('插件上下文创建失败时应该统一包装错误', async () => {
      const extensionError = new Error('create context failed')

      class BrokenContextHost extends TestablePluginHost {
        protected override getPluginContextExtensions(): Record<
          string,
          unknown
        > {
          throw extensionError
        }
      }

      host = new BrokenContextHost({ cwd: mockCwd })
      const brokenPlugin = createTestPlugin(mockCwd, 'broken-context-plugin')
      vi.mocked(pluginResolver.resolvePresetsAndPlugins).mockReturnValue({
        presets: [],
        plugins: [[brokenPlugin, undefined]],
      })

      await expect(host.testLoad()).rejects.toMatchObject({
        cause: extensionError,
        code: PluginHostErrorCode.PluginInitializationFailed,
      })
    })
  })

  describe('创建插件上下文', () => {
    beforeEach(() => {
      host = new TestablePluginHost({ cwd: mockCwd })
    })

    it('应该为插件创建代理上下文', () => {
      const plugin = createTestPlugin(mockCwd, 'test-plugin')

      const pluginContext = host.testCreatePluginContext(plugin)

      expect(pluginContext).toBeTruthy()
      expect(pluginContext.cwd).toBe(host.cwd)
      expect(pluginContext.plugin).toEqual(plugin.getMetadata())
    })

    it('不应该枚举 PluginApi 的内部字段', () => {
      const plugin = createTestPlugin(mockCwd, 'test-plugin')
      const pluginContext = host.testCreatePluginContext(plugin)

      expect(Object.keys(pluginContext)).not.toEqual(
        expect.arrayContaining([
          '_host',
          '_plugin',
          '_remainingPlugins',
          '_remainingPresets',
          '_reservedMethodNames',
        ]),
      )
    })

    it('应该通过代理访问宿主授权的属性', () => {
      const plugin = createTestPlugin(mockCwd, 'test-plugin')

      const pluginContext = host.testCreatePluginContext(plugin)

      expect(pluginContext.cwd).toBe(host.cwd)
      expect(pluginContext.plugin).toEqual(plugin.getMetadata())
    })

    it('应该通过反射 API 暴露动态能力', () => {
      const plugin = createTestPlugin(mockCwd, 'test-plugin')
      const pluginContext = host.testCreatePluginContext(plugin)
      const capability = vi.fn()

      pluginContext.registerCapability('customCapability', capability)

      expect('customCapability' in pluginContext).toBe(true)
      expect(Object.keys(pluginContext)).toContain('customCapability')
      expect(
        (pluginContext as unknown as Record<string, unknown>).customCapability,
      ).toBe(capability)
    })

    it('应该禁止修改插件上下文结构并保持动态扩展能力', () => {
      const pluginContext = host.testCreatePluginContext(
        createTestPlugin(mockCwd, 'test-plugin'),
      )
      const capability = vi.fn()

      pluginContext.registerCapability('customCapability', capability)

      expect(Reflect.set(pluginContext, 'customCapability', vi.fn())).toBe(
        false,
      )
      expect(
        Reflect.defineProperty(pluginContext, 'extraProperty', {
          value: true,
        }),
      ).toBe(false)
      expect(Reflect.deleteProperty(pluginContext, 'customCapability')).toBe(
        false,
      )
      expect(Reflect.setPrototypeOf(pluginContext, null)).toBe(false)
      expect(Reflect.preventExtensions(pluginContext)).toBe(false)
      expect(Object.isExtensible(pluginContext)).toBe(true)
      expect(
        (pluginContext as unknown as Record<string, unknown>).customCapability,
      ).toBe(capability)
    })

    it('应该保持扩展方法的引用稳定并保留扩展对象作为 this', () => {
      class MethodExtensionHost extends TestablePluginHost {
        protected override getPluginContextExtensions() {
          return {
            calls: 0,
            invoke() {
              this.calls += 1
              return this.calls
            },
          }
        }
      }

      const extensionHost = new MethodExtensionHost({ cwd: mockCwd })
      const plugin = createTestPlugin(mockCwd, 'test-plugin')
      const pluginContext = extensionHost.testCreatePluginContext(
        plugin,
      ) as PluginContext<LooseHookSchema, { calls: number; invoke(): number }>

      expect(pluginContext.invoke).toBe(pluginContext.invoke)
      expect(pluginContext.invoke()).toBe(1)
      expect(pluginContext.calls).toBe(1)
    })

    it('应该在每次访问时重新读取扩展 getter', () => {
      let currentValue = 1

      class GetterExtensionHost extends TestablePluginHost {
        protected override getPluginContextExtensions() {
          return {
            get value() {
              return currentValue
            },
          }
        }
      }

      const extensionHost = new GetterExtensionHost({ cwd: mockCwd })
      const pluginContext = extensionHost.testCreatePluginContext(
        createTestPlugin(mockCwd, 'test-plugin'),
      ) as PluginContext<LooseHookSchema, { readonly value: number }>

      expect(pluginContext.value).toBe(1)
      currentValue = 2
      expect(pluginContext.value).toBe(2)
    })

    it.each([
      ['null', null],
      ['array', []],
      ['class instance', new (class Extension {})()],
      [
        'non-enumerable property',
        Object.defineProperty({}, 'hidden', { value: true }),
      ],
      ['symbol property', { [Symbol('extension')]: true }],
    ])('应该拒绝包含 %s 的扩展对象', (_name, extensions) => {
      class InvalidExtensionHost extends TestablePluginHost {
        protected override getPluginContextExtensions(): Record<
          string,
          unknown
        > {
          return extensions as Record<string, unknown>
        }
      }

      const invalidHost = new InvalidExtensionHost({ cwd: mockCwd })

      expect(() =>
        invalidHost.testCreatePluginContext(
          createTestPlugin(mockCwd, 'test-plugin'),
        ),
      ).toThrow(
        expect.objectContaining({
          code: PluginHostErrorCode.InvalidOptions,
        }),
      )
    })

    it.each(['', ' padded '])('应该拒绝无效的扩展属性名 %j', extensionName => {
      class InvalidExtensionNameHost extends TestablePluginHost {
        protected override getPluginContextExtensions() {
          return { [extensionName]: true }
        }
      }

      const invalidHost = new InvalidExtensionNameHost({ cwd: mockCwd })

      expect(() =>
        invalidHost.testCreatePluginContext(
          createTestPlugin(mockCwd, 'test-plugin'),
        ),
      ).toThrow(
        expect.objectContaining({
          code: PluginHostErrorCode.InvalidOptions,
        }),
      )
    })

    it('应该拒绝覆盖核心 Plugin API 的扩展', () => {
      class ConflictingPluginHost extends TestablePluginHost {
        protected override getPluginContextExtensions() {
          return {
            register: vi.fn(),
          }
        }
      }

      const conflictingPluginHost = new ConflictingPluginHost({ cwd: mockCwd })
      const plugin = createTestPlugin(mockCwd, 'test-plugin')

      expect(() =>
        conflictingPluginHost.testCreatePluginContext(plugin),
      ).toThrow(
        'getPluginContextExtensions() failed, property `register` conflicts with a reserved Plugin API name.',
      )
    })

    it('应该在全部插件上下文中保留已经出现的扩展属性名', () => {
      class ScopedExtensionHost extends TestablePluginHost {
        protected override getPluginContextExtensions(plugin: Plugin) {
          return plugin.id === 'extension-plugin'
            ? { scopedExtension: vi.fn() }
            : {}
        }
      }

      const scopedHost = new ScopedExtensionHost({ cwd: mockCwd })
      const retainedContext = scopedHost.testCreatePluginContext(
        createTestPlugin(mockCwd, 'retained-plugin'),
      )

      scopedHost.testCreatePluginContext(
        createTestPlugin(mockCwd, 'extension-plugin'),
      )

      expect(() =>
        retainedContext.registerCapability('scopedExtension', vi.fn()),
      ).toThrow(
        expect.objectContaining({
          code: PluginHostErrorCode.ApiNameConflict,
          details: expect.objectContaining({
            conflictSource: 'plugin-context-extension',
          }),
        }),
      )
    })
  })

  describe('添加类型钩子错误处理', () => {
    beforeEach(() => {
      host = new TestablePluginHost({ cwd: mockCwd })
      host.setStateForTesting(PluginHostState.Ready)
    })

    it('应该对添加类型的无效初始值抛出错误', async () => {
      await expect(
        (host as PluginHostWithInternals).runHook('addItems', {
          kind: HookKind.Add,
          initialValue: 'not an array',
        }),
      ).rejects.toThrow(
        'Run hook `addItems` failed, `options.initialValue` must be an array for an add Hook.',
      )
    })

    it('应该拒绝缺少初始值的修改 Hook', async () => {
      await expect(
        (host as PluginHostWithInternals).runHook('modifyConfig', {
          kind: HookKind.Modify,
        }),
      ).rejects.toMatchObject({
        code: PluginHostErrorCode.InvalidOptions,
      })
    })
  })

  describe('获取和事件类型钩子', () => {
    beforeEach(() => {
      host = new TestablePluginHost({ cwd: mockCwd })
      host.setStateForTesting(PluginHostState.Ready)
    })

    it('应该正确执行获取钩子', async () => {
      const mockFn = vi.fn().mockResolvedValue('result')
      const plugin = createTestPlugin(mockCwd, 'plugin1')
      const hook = {
        fn: mockFn,
        plugin,
        constructorOptions: { plugin, key: 'getConfig', fn: mockFn },
        key: 'getConfig',
      } as Hook
      host.testRegisterHooks(hook)

      const result = await (host as PluginHostWithInternals).runHook(
        'getConfig',
        {
          kind: HookKind.Get,
          args: { param: 'test' },
        },
      )

      expect(result).toBe('result')
      expect(mockFn).toHaveBeenCalledWith({ param: 'test' })
    })

    it('获取钩子应该跳过 null 并返回第一个非空结果', async () => {
      const firstFn = vi.fn().mockResolvedValue(null)
      const secondFn = vi.fn().mockResolvedValue('result')
      const firstPlugin = createTestPlugin(mockCwd, 'plugin1')
      const secondPlugin = createTestPlugin(mockCwd, 'plugin2')
      host.testRegisterHooks(
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
      )

      const result = await host.runHook('getConfig', {
        kind: HookKind.Get,
      })

      expect(result).toBe('result')
      expect(firstFn).toHaveBeenCalledOnce()
      expect(secondFn).toHaveBeenCalledOnce()
    })

    it('应该正确执行事件钩子', async () => {
      const mockFn = vi.fn().mockResolvedValue(undefined)
      const plugin = createTestPlugin(mockCwd, 'plugin1')
      const hook = {
        fn: mockFn,
        plugin,
        constructorOptions: { plugin, key: 'onStart', fn: mockFn },
        key: 'onStart',
      } as Hook
      host.testRegisterHooks(hook)

      const result = await (host as PluginHostWithInternals).runHook(
        'onStart',
        {
          kind: HookKind.Event,
          args: { eventData: 'test' },
        },
      )

      expect(result).toBeUndefined()
      expect(mockFn).toHaveBeenCalledWith({ eventData: 'test' })
    })
  })

  describe('插件启用状态检查', () => {
    beforeEach(() => {
      host = new TestablePluginHost({ cwd: mockCwd })
    })

    it('应该处理没有启用条件的插件', () => {
      const hook = createTestHook(mockCwd, {
        id: 'test-plugin',
        // 没有设置 enable 属性
      })

      const result = host.testIsPluginEnable(hook)

      expect(result).toBe(true) // 默认应该返回true
    })
  })
})
