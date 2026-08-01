import { PluginHostError, PluginHostErrorCode } from '../errors'
import type { Hook } from '../plugin/hook'
import type { HookRegistrationApi, HookSchema } from '../plugin/hook-schema'
import { Plugin } from '../plugin/plugin'
import { PluginApi, type PluginApiHostContext } from '../plugin/plugin-api'
import { PluginRegistry } from '../runtime/plugin-registry'
import type { ResolvedPlugin } from './types'

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
 * `PluginApi` 原型链占用的保留属性名快照
 *
 * @remarks
 * Hook Schema 和宿主扩展不能遮蔽这些名称，否则不同插件会看到不一致的核心 API
 *
 * @internal
 */
export const PLUGIN_API_RESERVED_PROPERTY_NAMES: ReadonlySet<string> = (() => {
  const names = new Set<string>()
  let prototype: object | null = PluginApi.prototype

  while (prototype) {
    Object.getOwnPropertyNames(prototype).forEach(name => names.add(name))
    prototype = Object.getPrototypeOf(prototype) as object | null
  }

  return names
})()

/**
 * 装配单个插件上下文所需的宿主状态
 *
 * @internal
 */
interface PluginContextFactoryOptions<
  Schema extends HookSchema,
  Extensions extends object,
> {
  extensions: Extensions
  hookSchema: Schema
  plugin: Plugin
  pluginApiHost: PluginApiHostContext
  pluginContextExtensionNames: Set<string>
  pluginRegistry: PluginRegistry
  remainingPlugins: ResolvedPlugin[]
  remainingPresets: ResolvedPlugin[]
}

/**
 * 校验宿主扩展并创建只读、动态可扩展的插件上下文代理
 *
 * @remarks
 * 调用方提供的扩展被视为不可信边界，只接受普通对象的自身可枚举字符串属性；
 * 函数属性会绑定原扩展对象，getter 和后注册 capability 则保持动态读取
 *
 * @typeParam Schema - Hook Schema 类型
 * @typeParam Extensions - 宿主扩展能力类型
 * @param options - 当前插件、宿主注册表和待装配扩展
 * @returns 合并核心 API、Hook 注册方法和宿主扩展能力的代理
 * @throws {@link PluginHostError} 扩展形态或属性名称违反上下文契约时抛出
 * @internal
 */
export function createPluginContext<
  Schema extends HookSchema,
  Extensions extends object,
>(
  options: PluginContextFactoryOptions<Schema, Extensions>,
): PluginContext<Schema, Extensions> {
  const {
    extensions,
    hookSchema,
    plugin,
    pluginApiHost,
    pluginContextExtensionNames,
    pluginRegistry,
    remainingPlugins,
    remainingPresets,
  } = options
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
    (extensionPrototype !== Object.prototype && extensionPrototype !== null) ||
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

  const hookNames = Object.keys(hookSchema)
  const conflictingExtensionName = extensionNames.find(
    name =>
      PLUGIN_API_RESERVED_PROPERTY_NAMES.has(name) ||
      hookNames.includes(name) ||
      pluginRegistry.hasCapability(name),
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

  extensionNames.forEach(name => pluginContextExtensionNames.add(name))
  const pluginApi = new PluginApi(pluginApiHost, plugin, {
    remainingPlugins,
    remainingPresets,
    reservedMethodNames: [...hookNames, ...pluginContextExtensionNames],
  })
  const hookRegistrations = Object.fromEntries(
    hookNames.map(name => [
      name,
      (
        fn: Hook['fn'],
        hookOptions: Omit<
          Hook['constructorOptions'],
          'plugin' | 'key' | 'fn'
        > = {},
      ) => pluginApi.register(name, fn, hookOptions),
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
    pluginRegistry.hasCapability(name)

  const getDynamicProperty = (name: string): unknown => {
    if (Object.hasOwn(extensionRecord, name)) {
      return boundExtensionFunctions.has(name)
        ? boundExtensionFunctions.get(name)
        : Reflect.get(extensionRecord, name, extensions)
    }

    if (Object.hasOwn(hookRegistrations, name)) {
      return hookRegistrations[name]
    }

    return pluginRegistry.getCapability(name)
  }

  return new Proxy(pluginApi, {
    get: (target, property, receiver) =>
      typeof property === 'string' && hasDynamicProperty(property)
        ? getDynamicProperty(property)
        : Reflect.get(target, property, receiver),
    getOwnPropertyDescriptor: (target, property) => {
      if (typeof property === 'string' && hasDynamicProperty(property)) {
        return {
          configurable: true,
          enumerable: true,
          value: getDynamicProperty(property),
          writable: false,
        }
      }

      return Reflect.getOwnPropertyDescriptor(target, property)
    },
    has: (target, property) =>
      (typeof property === 'string' && hasDynamicProperty(property)) ||
      Reflect.has(target, property),
    ownKeys: target => [
      ...new Set([
        ...Reflect.ownKeys(target),
        ...extensionNames,
        ...hookNames,
        ...pluginRegistry.getCapabilityNames(),
      ]),
    ],
    defineProperty: () => false,
    deleteProperty: () => false,
    preventExtensions: () => false,
    set: () => false,
    setPrototypeOf: () => false,
  }) as PluginContext<Schema, Extensions>
}
