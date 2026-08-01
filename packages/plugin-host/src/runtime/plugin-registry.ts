import type { MaybePromiseFunction } from '@eljs/utils/types'

import { PluginHostError, PluginHostErrorCode } from '../errors'
import type { Plugin } from '../plugin/plugin'
import type { PluginDiagnostics } from '../plugin/types'

/**
 * 一个延迟解析的 Hook 跳过请求
 */
interface HookDisableRequest {
  /**
   * 发起请求的插件
   */
  requester: Plugin
  /**
   * 目标插件 key
   */
  targetKey: string
}

/**
 * 已注册的插件能力及其提供者
 */
interface CapabilityRegistration {
  /**
   * 能力实现
   */
  fn: MaybePromiseFunction
  /**
   * 提供能力的插件
   */
  provider: Plugin
}

/**
 * Plugin 及其运行时能力注册表
 *
 * @internal
 */
export class PluginRegistry {
  /**
   * 插件 ID 到插件实例的映射
   */
  private _pluginsById = new Map<string, Plugin>()
  /**
   * 插件 key 到插件实例的映射
   */
  private _pluginsByKey = new Map<string, Plugin>()
  /**
   * 动态 API 方法注册表
   */
  private _capabilities = new Map<string, CapabilityRegistration>()
  /**
   * 等待全部插件加载后解析的跳过请求
   */
  private _hookDisableRequests: HookDisableRequest[] = []
  /**
   * Hook 已被禁用的插件 ID
   */
  private _disabledHookPluginIds = new Set<string>()

  /**
   * 在执行插件入口前预留插件 ID
   *
   * @param plugin - 待预留 ID 的插件
   * @throws {@link PluginHostError}
   * 当插件 ID 已被占用时抛出
   */
  public reserve(plugin: Plugin): void {
    const registered = this._pluginsById.get(plugin.id)

    if (registered) {
      throw new PluginHostError(
        PluginHostErrorCode.DuplicatePlugin,
        `${plugin.type} \`${plugin.id}\` has already been registered by ${registered.path}, ${plugin.type} from ${plugin.path} register failed.`,
        {
          details: {
            pluginId: plugin.id,
            pluginPath: plugin.path,
            registeredPath: registered.path,
          },
        },
      )
    }

    this._pluginsById.set(plugin.id, plugin)
  }

  /**
   * 插件入口执行完成后提交插件 key
   *
   * @param plugin - 已完成初始化的插件
   * @throws {@link PluginHostError}
   * 当插件 key 已被占用时抛出
   */
  public complete(plugin: Plugin): void {
    const registered = this._pluginsByKey.get(plugin.key)

    if (registered) {
      throw new PluginHostError(
        PluginHostErrorCode.DuplicatePlugin,
        `\`${plugin.key}\` has already been registered by ${registered.path}, ${plugin.type} from ${plugin.path} register failed.`,
        {
          details: {
            pluginKey: plugin.key,
            pluginPath: plugin.path,
            registeredPath: registered.path,
          },
        },
      )
    }

    this._pluginsByKey.set(plugin.key, plugin)
  }

  /**
   * 注册插件提供的显式能力
   *
   * @param name - 能力名称
   * @param plugin - 提供能力的插件
   * @param fn - 能力实现
   * @throws {@link PluginHostError}
   * 当能力名称已注册时抛出
   */
  public registerCapability(
    name: string,
    plugin: Plugin,
    fn: MaybePromiseFunction,
  ): void {
    const registered = this._capabilities.get(name)

    if (registered) {
      throw new PluginHostError(
        PluginHostErrorCode.ApiNameConflict,
        `PluginApi.registerCapability() failed, capability \`${name}\` is already provided by plugin \`${registered.provider.id}\`.`,
        {
          details: {
            capabilityName: name,
            pluginId: plugin.id,
            pluginKey: plugin.key,
            pluginPath: plugin.path,
            registeredPluginId: registered.provider.id,
            registeredPluginKey: registered.provider.key,
            registeredPluginPath: registered.provider.path,
          },
        },
      )
    }

    this._capabilities.set(name, { fn, provider: plugin })
  }

  /**
   * 判断能力是否已注册
   *
   * @param name - 能力名称
   * @returns 能力是否存在
   */
  public hasCapability(name: string): boolean {
    return this._capabilities.has(name)
  }

  /**
   * 获取插件能力
   *
   * @param name - 能力名称
   * @returns 已注册的方法实现；不存在时返回 `undefined`
   */
  public getCapability(name: string): MaybePromiseFunction | undefined {
    return this._capabilities.get(name)?.fn
  }

  /**
   * 获取已经注册的能力名称
   *
   * @returns 当前能力名称快照
   */
  public getCapabilityNames(): string[] {
    return [...this._capabilities.keys()]
  }

  /**
   * 按 key 获取插件
   *
   * @param key - 插件 key
   * @returns 插件实例；不存在时返回 `undefined`
   */
  public getByKey(key: string): Plugin | undefined {
    return this._pluginsByKey.get(key)
  }

  /**
   * 声明需要跳过 Hook 的插件 key
   *
   * @param requester - 发起请求的插件
   * @param targetKeys - 目标插件 key 集合
   */
  public requestHookDisable(
    requester: Plugin,
    targetKeys: readonly string[],
  ): void {
    this._hookDisableRequests.push(
      ...targetKeys.map(targetKey => ({ requester, targetKey })),
    )
  }

  /**
   * 在全部插件注册完成后解析 Hook 跳过声明
   *
   * @throws {@link PluginHostError}
   * 当插件尝试跳过自身或目标插件不存在时抛出
   */
  public resolveHookDisables(): void {
    for (const { requester, targetKey } of this._hookDisableRequests) {
      if (requester.key === targetKey) {
        throw new PluginHostError(
          PluginHostErrorCode.InvalidPluginReference,
          `Plugin \`${targetKey}\` could not skip itself.`,
          {
            details: {
              pluginId: requester.id,
              pluginKey: requester.key,
              targetKey,
            },
          },
        )
      }

      const target = this._pluginsByKey.get(targetKey)
      if (!target) {
        throw new PluginHostError(
          PluginHostErrorCode.InvalidPluginReference,
          `\`${targetKey}\` has not been registered by any plugin, its hooks could not be skipped.`,
          {
            details: {
              pluginId: requester.id,
              pluginKey: requester.key,
              targetKey,
            },
          },
        )
      }

      this._disabledHookPluginIds.add(target.id)
    }
  }

  /**
   * 判断插件的 Hook 是否可以执行
   *
   * @param plugin - Hook 所属插件
   * @returns Hook 是否启用
   */
  public isHookEnabled(plugin: Plugin): boolean {
    if (this._disabledHookPluginIds.has(plugin.id)) {
      return false
    }

    try {
      return typeof plugin.enable === 'function'
        ? plugin.enable()
        : plugin.enable
    } catch (error) {
      throw new PluginHostError(
        PluginHostErrorCode.HookEnablementFailed,
        `Evaluate Hook enablement for plugin \`${plugin.key}\` failed: ${
          (error as Error).message
        }`,
        {
          cause: error,
          details: {
            pluginId: plugin.id,
            pluginKey: plugin.key,
            pluginPath: plugin.path,
          },
        },
      )
    }
  }

  /**
   * 获取调试信息快照
   *
   * @returns 与内部可变数据隔离的插件诊断列表
   */
  public getDiagnostics(): PluginDiagnostics[] {
    return [...this._pluginsById.values()].map(plugin =>
      plugin.getDiagnostics(),
    )
  }

  /**
   * 清空注册表
   */
  public clear(): void {
    this._pluginsById = new Map<string, Plugin>()
    this._pluginsByKey = new Map<string, Plugin>()
    this._capabilities = new Map<string, CapabilityRegistration>()
    this._hookDisableRequests = []
    this._disabledHookPluginIds = new Set<string>()
  }
}
