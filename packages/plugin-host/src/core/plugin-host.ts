import { ConfigManager } from '@eljs/config'
import { isDirectorySync } from '@eljs/utils'
import { resolve as resolvePath } from 'node:path'

import { PluginHostError, PluginHostErrorCode } from '../errors'
import type { Hook } from '../plugin/hook'
import type {
  HookRegistrationApi,
  HookRunArguments,
  HookRunResult,
  HookSchema,
  LooseHookSchema,
} from '../plugin/hook-schema'
import { Plugin } from '../plugin/plugin'
import { PluginApi, type PluginApiHostContext } from '../plugin/plugin-api'
import {
  resolvePluginDeclarations,
  resolvePresetsAndPlugins,
} from '../plugin/plugin-resolver'
import {
  PluginKind,
  type PluginDiagnostics,
  type PluginInitializationResult,
  type ResolvedPluginInitializationResult,
} from '../plugin/types'
import { HookExecutor } from '../runtime/hook-executor'
import { HookRegistry } from '../runtime/hook-registry'
import { PluginRegistry } from '../runtime/plugin-registry'
import {
  HookKind,
  PluginHostState,
  type LooseHookRunOptions,
  type PluginHostOptions,
  type ResolvedPlugin,
  type UserConfig,
} from './types'

const PLUGIN_API_RESERVED_PROPERTY_NAMES = (() => {
  const names = new Set<string>()
  let prototype: object | null = PluginApi.prototype

  while (prototype) {
    Object.getOwnPropertyNames(prototype).forEach(name => names.add(name))
    prototype = Object.getPrototypeOf(prototype) as object | null
  }

  return names
})()

/**
 * 合并核心插件 API、Schema 注册 API 和 Runner 扩展能力
 *
 * @remarks
 * 运行时上下文保持可扩展以接收后续注册的 capability，但插件不能赋值、
 * 重定义、删除上下文属性，也不能冻结对象或替换其原型
 *
 * @typeParam Schema - Runner 的 Hook Schema
 * @typeParam Extensions - Runner 显式暴露给插件的能力
 */
export type PluginContext<
  Schema extends HookSchema,
  Extensions extends object = Record<string, unknown>,
> = PluginApi & HookRegistrationApi<Schema> & Extensions

/**
 * 持有插件生命周期并提供解析、初始化、Hook 注册与执行能力
 *
 * @typeParam Config - 用户配置类型
 * @typeParam Schema - Hook Schema 类型
 * @typeParam Extensions - 显式注入 Plugin API 的能力类型
 */
export abstract class PluginHost<
  Config extends UserConfig = UserConfig,
  Schema extends HookSchema = LooseHookSchema,
  Extensions extends object = Record<string, unknown>,
> {
  /**
   * 构造函数选项
   */
  public readonly constructorOptions: Readonly<PluginHostOptions>
  /**
   * 配置来源加载出的用户配置
   */
  protected userConfig: Config | null = null
  /**
   * Hook 注册表
   */
  private readonly _hooks = new HookRegistry()
  /**
   * 插件及动态能力注册表
   */
  private readonly _plugins = new PluginRegistry()
  /**
   * Hook 聚合执行器
   */
  private readonly _hookExecutor: HookExecutor
  /**
   * 提供给 `PluginApi` 的最小宿主上下文
   */
  private readonly _pluginApiHost: PluginApiHostContext
  /**
   * 当前生命周期状态
   */
  private _state = PluginHostState.Uninitialized
  /**
   * Hook 运行时契约
   */
  private readonly _hookSchema: Schema
  /**
   * 所有插件上下文扩展占用的全局属性名
   */
  private readonly _pluginContextExtensionNames = new Set<string>()
  /**
   * 加载失败前捕获的插件诊断快照
   */
  private _failureDiagnostics: PluginDiagnostics[] = []

  /**
   * 当前工作目录
   *
   * @returns 构造选项中的工作目录
   */
  public get cwd(): string {
    return this.constructorOptions.cwd
  }

  /**
   * 当前生命周期状态
   *
   * @returns 只读生命周期状态
   */
  public get state(): PluginHostState {
    return this._state
  }

  /**
   * 创建插件宿主
   *
   * @param options - 工作目录、插件声明和配置文件约定
   * @param hookSchema - Hook 的运行时及类型契约
   * @throws {@link PluginHostError}
   * 当工作目录不存在时抛出
   */
  public constructor(options: PluginHostOptions, hookSchema?: Schema) {
    if (!options || typeof options.cwd !== 'string' || !options.cwd.trim()) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidOptions,
        `PluginHost requires a non-empty \`cwd\` string.`,
        { details: { options } },
      )
    }

    const cwd = resolvePath(options.cwd)
    if (!isDirectorySync(cwd)) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidOptions,
        `Invalid cwd ${options.cwd}, expected an existing directory.`,
        { details: { cwd: options.cwd, resolvedCwd: cwd } },
      )
    }
    this.constructorOptions = Object.freeze({
      ...options,
      cwd,
      defaultConfigExts: options.defaultConfigExts
        ? Object.freeze([...options.defaultConfigExts])
        : undefined,
      defaultConfigFiles: options.defaultConfigFiles
        ? Object.freeze([...options.defaultConfigFiles])
        : undefined,
      plugins: options.plugins
        ? Object.freeze([...options.plugins])
        : undefined,
      presets: options.presets
        ? Object.freeze([...options.presets])
        : undefined,
    })
    const schemaEntries = Object.entries(
      hookSchema || Object.create(null),
    ) as Array<[string, Schema[keyof Schema]]>
    const validHookKinds = new Set<string>(Object.values(HookKind))
    for (const [key, definition] of schemaEntries) {
      if (
        !key.trim() ||
        key !== key.trim() ||
        !definition ||
        !validHookKinds.has(definition.kind)
      ) {
        throw new PluginHostError(
          PluginHostErrorCode.InvalidHook,
          `Invalid Hook Schema definition for \`${key}\`.`,
          {
            details: {
              hookKey: key,
              hookKind: definition?.kind,
            },
          },
        )
      }

      if (PLUGIN_API_RESERVED_PROPERTY_NAMES.has(key)) {
        throw new PluginHostError(
          PluginHostErrorCode.ApiNameConflict,
          `Hook Schema property \`${key}\` conflicts with a reserved Plugin API name.`,
          { details: { hookKey: key } },
        )
      }
    }
    this._hookSchema = Object.freeze(
      Object.fromEntries(
        schemaEntries.map(([key, definition]) => [
          key,
          Object.freeze({ ...definition }),
        ]),
      ),
    ) as unknown as Schema
    this._hookExecutor = new HookExecutor(
      this._hooks,
      this._plugins,
      this._hookSchema,
    )

    const getCwd = () => this.cwd
    const getState = () => this.state
    this._pluginApiHost = {
      get cwd() {
        return getCwd()
      },
      get state() {
        return getState()
      },
      registerHook: hook => this._registerHook(hook),
      registerPluginCapability: (name, plugin, fn) =>
        this._registerPluginCapability(name, plugin, fn),
      requestPluginHookDisable: (requester, targetKeys) =>
        this._plugins.requestHookDisable(requester, targetKeys),
      resolvePlugins: (declarations, type, origin) =>
        resolvePluginDeclarations(declarations, type, this.cwd, origin),
    }
  }

  /**
   * 严格一次地加载 preset、plugin 及其 Hook
   *
   * @remarks
   * 加载失败后会清空部分注册数据并进入不可重试的 `failed` 状态
   *
   * @throws {@link PluginHostError}
   * 当实例已加载、加载失败或插件声明无效时抛出
   */
  protected async load(): Promise<void> {
    if (this._state !== PluginHostState.Uninitialized) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidState,
        `PluginHost.load() can only be called once from the \`${PluginHostState.Uninitialized}\` state, current state is \`${this._state}\`.`,
      )
    }

    this._state = PluginHostState.LoadingConfig

    try {
      await this._load()
      this._state = PluginHostState.Ready
    } catch (error) {
      this._failureDiagnostics = this._plugins.getDiagnostics()
      this._resetRuntimeState()
      this._state = PluginHostState.Failed
      throw error
    }
  }

  /**
   * 执行配置加载、preset 初始化和 plugin 初始化流程
   */
  private async _load(): Promise<void> {
    const configManager = new ConfigManager({
      defaultConfigFiles: [
        ...(this.constructorOptions.defaultConfigFiles || []),
      ],
      defaultConfigExts: this.constructorOptions.defaultConfigExts
        ? [...this.constructorOptions.defaultConfigExts]
        : undefined,
      cwd: this.cwd,
    })
    this.userConfig = (await configManager.getConfig()) as Config

    const constructorPresets = this.constructorOptions.presets || []
    const userPresets = this.userConfig?.presets || []
    const constructorPlugins = this.constructorOptions.plugins || []
    const userPlugins = this.userConfig?.plugins || []

    const { plugins = [], presets = [] } = resolvePresetsAndPlugins(
      this.constructorOptions.cwd,
      [...constructorPresets, ...userPresets],
      [...constructorPlugins, ...userPlugins],
    )

    // #region register presets
    this._state = PluginHostState.LoadingPresets

    // 预设返回的插件集合
    const pluginsFromPresets: ResolvedPlugin[] = []
    while (presets.length) {
      await this._initializePreset(
        presets.shift() as ResolvedPlugin,
        presets,
        pluginsFromPresets,
      )
    }
    // #endregion

    // #region register plugins
    plugins.unshift(...pluginsFromPresets)
    this._state = PluginHostState.LoadingPlugins

    while (plugins.length) {
      await this._initializePlugin(
        plugins.shift() as ResolvedPlugin,
        [],
        plugins,
      )
    }
    this._plugins.resolveHookDisables()
    // #endregion
  }

  /**
   * 为当前插件提供宿主明确授权的上下文扩展
   *
   * @remarks
   * 必须返回只包含自身可枚举字符串属性的普通对象
   * 数据属性中的函数会绑定扩展对象并保持引用稳定，getter 会在每次访问时重新求值
   *
   * @param _plugin - 当前正在初始化的插件实例
   * @returns 合并到当前插件上下文的扩展能力
   */
  protected getPluginContextExtensions(_plugin: Plugin): Extensions {
    return {} as Extensions
  }

  /**
   * 为指定插件创建隔离的插件上下文
   *
   * @param plugin - 当前插件
   * @param remainingPresets - 当前加载流程中尚未初始化的 preset
   * @param remainingPlugins - 当前加载流程中尚未初始化的 plugin
   * @returns 合并核心 API、Hook 注册方法和宿主扩展能力的插件上下文
   * @throws {@link PluginHostError}
   * 当扩展对象无效或属性名称与保留 API 冲突时抛出
   */
  private _createPluginContext(
    plugin: Plugin,
    remainingPresets: ResolvedPlugin[] = [],
    remainingPlugins: ResolvedPlugin[] = [],
  ): PluginContext<Schema, Extensions> {
    const extensions = this.getPluginContextExtensions(plugin)
    const extensionType =
      extensions === null
        ? 'null'
        : Array.isArray(extensions)
          ? 'array'
          : typeof extensions
    const extensionPrototype =
      extensionType === 'object' ? Object.getPrototypeOf(extensions) : undefined
    const extensionKeys =
      extensionType === 'object' ? Reflect.ownKeys(extensions) : []
    const hasUnsupportedKeys = extensionKeys.some(key => {
      if (typeof key !== 'string') {
        return true
      }

      return !Object.getOwnPropertyDescriptor(extensions, key)?.enumerable
    })

    if (
      extensionType !== 'object' ||
      (extensionPrototype !== Object.prototype &&
        extensionPrototype !== null) ||
      hasUnsupportedKeys
    ) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidOptions,
        `getPluginContextExtensions() must return a plain object containing only own enumerable string properties.`,
        {
          details: {
            extensionType,
            pluginId: plugin.id,
            unsupportedKeys: extensionKeys
              .filter(key => {
                if (typeof key !== 'string') {
                  return true
                }
                return !Object.getOwnPropertyDescriptor(extensions, key)
                  ?.enumerable
              })
              .map(String),
          },
        },
      )
    }

    const extensionRecord = extensions as Record<string, unknown>
    const extensionNames = Object.keys(extensions)
    const invalidExtensionName = extensionNames.find(
      name => !name.trim() || name !== name.trim(),
    )

    if (invalidExtensionName !== undefined) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidOptions,
        `Plugin context extension names must be non-empty trimmed strings.`,
        {
          details: {
            extensionName: invalidExtensionName,
            pluginId: plugin.id,
          },
        },
      )
    }

    const hookNames = Object.keys(this._hookSchema)
    const conflictingExtensionName = extensionNames.find(
      name =>
        PLUGIN_API_RESERVED_PROPERTY_NAMES.has(name) ||
        hookNames.includes(name) ||
        this._plugins.hasCapability(name),
    )

    if (conflictingExtensionName) {
      throw new PluginHostError(
        PluginHostErrorCode.ApiNameConflict,
        `getPluginContextExtensions() failed, property \`${conflictingExtensionName}\` conflicts with a reserved Plugin API name.`,
        {
          details: {
            extensionName: conflictingExtensionName,
            pluginId: plugin.id,
          },
        },
      )
    }

    extensionNames.forEach(name => this._pluginContextExtensionNames.add(name))
    const pluginApi = new PluginApi(this._pluginApiHost, plugin, {
      remainingPlugins,
      remainingPresets,
      reservedMethodNames: [...hookNames, ...this._pluginContextExtensionNames],
    })
    const hookRegistrations = Object.fromEntries(
      hookNames.map(name => [
        name,
        (
          fn: Hook['fn'],
          options: Omit<
            Hook['constructorOptions'],
            'plugin' | 'key' | 'fn'
          > = {},
        ) => pluginApi.register(name, fn, options),
      ]),
    ) as Record<string, unknown>
    const boundExtensionFunctions = new Map<string, unknown>()

    for (const name of extensionNames) {
      const descriptor = Object.getOwnPropertyDescriptor(extensions, name)
      if (
        descriptor &&
        'value' in descriptor &&
        typeof descriptor.value === 'function'
      ) {
        boundExtensionFunctions.set(name, descriptor.value.bind(extensions))
      }
    }

    const hasDynamicProperty = (name: string): boolean =>
      Object.hasOwn(extensionRecord, name) ||
      Object.hasOwn(hookRegistrations, name) ||
      this._plugins.hasCapability(name)

    const getDynamicProperty = (name: string): unknown => {
      if (Object.hasOwn(extensionRecord, name)) {
        return boundExtensionFunctions.has(name)
          ? boundExtensionFunctions.get(name)
          : Reflect.get(extensionRecord, name, extensions)
      }

      if (Object.hasOwn(hookRegistrations, name)) {
        return hookRegistrations[name]
      }

      return this._plugins.getCapability(name)
    }

    return new Proxy(pluginApi, {
      get: (target, prop, receiver) =>
        typeof prop === 'string' && hasDynamicProperty(prop)
          ? getDynamicProperty(prop)
          : Reflect.get(target, prop, receiver),
      getOwnPropertyDescriptor: (target, prop) => {
        if (typeof prop === 'string' && hasDynamicProperty(prop)) {
          return {
            configurable: true,
            enumerable: true,
            value: getDynamicProperty(prop),
            writable: false,
          }
        }

        return Reflect.getOwnPropertyDescriptor(target, prop)
      },
      has: (target, prop) =>
        (typeof prop === 'string' && hasDynamicProperty(prop)) ||
        Reflect.has(target, prop),
      ownKeys: target => [
        ...new Set([
          ...Reflect.ownKeys(target),
          ...extensionNames,
          ...hookNames,
          ...this._plugins.getCapabilityNames(),
        ]),
      ],
      defineProperty: () => false,
      deleteProperty: () => false,
      preventExtensions: () => false,
      set: () => false,
      setPrototypeOf: () => false,
    }) as PluginContext<Schema, Extensions>
  }

  /**
   * 根据 Hook Schema 校验并注册 Hook
   *
   * @remarks
   * 未提供 Schema 时保留兼容的宽松注册模式
   *
   * @param hook - 待注册的 Hook
   * @throws {@link PluginHostError}
   * 当 Hook key 未在现有 Schema 中声明时抛出
   */
  private _registerHook(hook: Hook): void {
    const schemaKeys = Object.keys(this._hookSchema)

    if (schemaKeys.length > 0 && !Object.hasOwn(this._hookSchema, hook.key)) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidHook,
        `Register hook \`${hook.key}\` failed, it is not defined in the Hook Schema.`,
        {
          details: {
            hookKey: hook.key,
            pluginId: hook.plugin.id,
            schemaKeys,
          },
        },
      )
    }

    this._hooks.register(hook)
  }

  /**
   * 根据宿主全局命名空间校验并注册插件能力
   *
   * @param name - 能力名称
   * @param plugin - 提供能力的插件
   * @param fn - 能力实现
   * @throws {@link PluginHostError}
   * 当能力名称与 Hook 或任一插件上下文扩展冲突时抛出
   */
  private _registerPluginCapability(
    name: string,
    plugin: Plugin,
    fn: Parameters<PluginRegistry['registerCapability']>[2],
  ): void {
    const conflictsWithHook = Object.hasOwn(this._hookSchema, name)
    const conflictsWithExtension = this._pluginContextExtensionNames.has(name)

    if (conflictsWithHook || conflictsWithExtension) {
      throw new PluginHostError(
        PluginHostErrorCode.ApiNameConflict,
        `PluginApi.registerCapability() failed, capability \`${name}\` conflicts with a reserved Plugin API name.`,
        {
          details: {
            capabilityName: name,
            conflictSource: conflictsWithHook
              ? 'hook-schema'
              : 'plugin-context-extension',
            pluginId: plugin.id,
          },
        },
      )
    }

    this._plugins.registerCapability(name, plugin, fn)
  }

  /**
   * 初始化一个 preset 并合并其嵌套声明
   *
   * @param currentPreset - 当前 preset
   * @param remainingPresets - 待处理 preset 队列
   * @param pluginsFromPresets - preset 返回的 plugin 集合
   */
  private async _initializePreset(
    currentPreset: ResolvedPlugin,
    remainingPresets: ResolvedPlugin[],
    pluginsFromPresets: ResolvedPlugin[],
  ): Promise<void> {
    const { presets: nestedPresets = [], plugins: nestedPlugins = [] } =
      await this._initializePlugin(
        currentPreset,
        remainingPresets,
        pluginsFromPresets,
      )

    remainingPresets.unshift(...nestedPresets)
    pluginsFromPresets.push(...nestedPlugins)
  }

  /**
   * 初始化一个 preset 或 plugin
   *
   * @param currentPlugin - 当前插件元组
   * @param remainingPresets - 待处理 preset 队列
   * @param remainingPlugins - 待处理 plugin 队列
   * @returns preset 返回的已解析嵌套声明；plugin 返回空对象
   * @throws {@link PluginHostError}
   * 当插件重复、加载失败、初始化失败或返回值无效时抛出
   */
  private async _initializePlugin(
    currentPlugin: ResolvedPlugin,
    remainingPresets: ResolvedPlugin[],
    remainingPlugins?: ResolvedPlugin[],
  ): Promise<ResolvedPluginInitializationResult> {
    const [plugin, pluginOptions, origin] = currentPlugin
    this._plugins.reserve(plugin)

    const initializationStart = performance.now()
    let pluginResult: PluginInitializationResult | void
    let initializationFailed = true

    try {
      try {
        const pluginContext = this._createPluginContext(
          plugin,
          remainingPresets,
          remainingPlugins || [],
        )
        const initialize = await plugin.loadInitializer()
        pluginResult = await initialize(pluginContext, pluginOptions)
      } catch (error) {
        if (error instanceof PluginHostError) {
          throw error
        }

        throw new PluginHostError(
          PluginHostErrorCode.PluginInitializationFailed,
          `Initialize ${plugin.type} \`${plugin.id}\` from ${plugin.path} failed: ${
            (error as Error).message
          }`,
          {
            cause: error,
            details: {
              origin,
              pluginId: plugin.id,
              pluginKey: plugin.key,
              pluginPath: plugin.path,
              pluginType: plugin.type,
            },
          },
        )
      }

      if (plugin.type === PluginKind.Plugin && pluginResult !== undefined) {
        throw new PluginHostError(
          PluginHostErrorCode.InvalidPluginResult,
          `Plugin should return nothing.`,
          {
            details: {
              origin,
              pluginId: plugin.id,
              pluginKey: plugin.key,
              pluginPath: plugin.path,
            },
          },
        )
      }

      if (
        plugin.type === PluginKind.Preset &&
        pluginResult !== undefined &&
        (pluginResult === null ||
          typeof pluginResult !== 'object' ||
          Array.isArray(pluginResult) ||
          (pluginResult.presets !== undefined &&
            !Array.isArray(pluginResult.presets)) ||
          (pluginResult.plugins !== undefined &&
            !Array.isArray(pluginResult.plugins)))
      ) {
        throw new PluginHostError(
          PluginHostErrorCode.InvalidPluginResult,
          `Preset should return an object containing optional \`presets\` and \`plugins\` arrays.`,
          {
            details: {
              origin,
              pluginId: plugin.id,
              pluginKey: plugin.key,
              pluginPath: plugin.path,
              result: pluginResult,
            },
          },
        )
      }

      this._plugins.complete(plugin)

      // Only presets can return additional presets/plugins
      if (plugin.type === PluginKind.Preset && pluginResult) {
        const result: ResolvedPluginInitializationResult = {}

        if (pluginResult.presets?.length) {
          result.presets = resolvePluginDeclarations(
            pluginResult.presets,
            PluginKind.Preset,
            this.cwd,
            {
              source: 'preset-result',
              parentPlugin: this._getPluginOrigin(plugin),
            },
          )
        }

        if (pluginResult.plugins?.length) {
          result.plugins = resolvePluginDeclarations(
            pluginResult.plugins,
            PluginKind.Plugin,
            this.cwd,
            {
              source: 'preset-result',
              parentPlugin: this._getPluginOrigin(plugin),
            },
          )
        }

        initializationFailed = false
        return result
      }

      initializationFailed = false
      return {}
    } finally {
      plugin.recordInitialization(
        performance.now() - initializationStart,
        initializationFailed,
      )
    }
  }

  /**
   * 创建插件来源追踪所需的元数据快照
   *
   * @param plugin - 来源插件
   * @returns 插件 ID、key、路径和类型
   */
  private _getPluginOrigin(plugin: Plugin) {
    const { id, key, path, type } = plugin
    return { id, key, path, type }
  }

  /**
   * 执行一个由 Hook Schema 声明的 Hook
   *
   * @typeParam Key - Hook Schema 中的 Hook key
   * @param key - Hook key
   * @param args - 由 Hook 定义推导出的执行选项
   * @returns 由 Hook 类型和值类型推导出的执行结果
   * @throws {@link PluginHostError}
   * 当运行时尚未加载完成或 Hook 调用参数无效时抛出
   */
  public async runHook<Key extends keyof Schema & string>(
    key: Key,
    ...args: HookRunArguments<Schema[NoInfer<Key>]>
  ): Promise<HookRunResult<Schema[Key]>> {
    if (this._state !== PluginHostState.Ready) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidState,
        `PluginHost.runHook() can only be called from the \`${PluginHostState.Ready}\` state, current state is \`${this._state}\`.`,
      )
    }

    const options = (args[0] || {}) as LooseHookRunOptions<unknown, unknown>
    return (await this._hookExecutor.run(key, options)) as HookRunResult<
      Schema[Key]
    >
  }

  /**
   * 判断插件注册的 Hook 是否可以执行
   *
   * @param hook - Hook 记录或插件 key
   * @returns Hook 是否启用
   * @throws {@link PluginHostError}
   * 当插件 key 尚未注册时抛出
   */
  protected isPluginHookEnabled(hook: Hook | string): boolean {
    const plugin = (hook as Hook).plugin
      ? (hook as Hook).plugin
      : this._plugins.getByKey(hook as string)
    if (!plugin) {
      throw new PluginHostError(
        PluginHostErrorCode.InvalidPluginReference,
        `Plugin \`${String(hook)}\` has not been registered.`,
        { details: { pluginKey: String(hook) } },
      )
    }
    return this._plugins.isHookEnabled(plugin)
  }

  /**
   * 获取插件调试信息快照
   *
   * @returns 不暴露内部可变对象的插件诊断快照
   */
  public getPluginDiagnostics(): PluginDiagnostics[] {
    const diagnostics =
      this._state === PluginHostState.Failed
        ? this._failureDiagnostics
        : this._plugins.getDiagnostics()

    return diagnostics.map(diagnostic => ({
      ...diagnostic,
      metrics: {
        ...diagnostic.metrics,
        hookDurationsMs: Object.fromEntries(
          Object.entries(diagnostic.metrics.hookDurationsMs).map(
            ([key, samples]) => [key, [...samples]],
          ),
        ),
        hookErrorCounts: { ...diagnostic.metrics.hookErrorCounts },
      },
    }))
  }

  /**
   * 清理失败加载产生的运行期注册数据
   */
  private _resetRuntimeState(): void {
    this.userConfig = null
    this._hooks.clear()
    this._plugins.clear()
    this._pluginContextExtensionNames.clear()
  }
}
