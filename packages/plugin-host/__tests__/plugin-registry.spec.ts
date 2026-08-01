import { describe, expect, it, vi } from 'vitest'

import { PluginHostErrorCode } from '../src'
import { PluginRegistry } from '../src/runtime/plugin-registry'
import { createMockPlugin } from './setup'

describe('PluginRegistry', () => {
  it('应该在所有插件注册后解析与顺序无关的 Hook 跳过声明', () => {
    const registry = new PluginRegistry()
    const requester = createMockPlugin('requester')
    const target = createMockPlugin('target')

    registry.reserve(requester)
    registry.complete(requester)
    registry.requestHookDisable(requester, [target.key])

    // target 在 skip 声明之后才注册
    registry.reserve(target)
    registry.complete(target)
    registry.resolveHookDisables()

    expect(registry.isHookEnabled(target)).toBe(false)
  })

  it('应该拒绝插件跳过自己的 Hook', () => {
    const registry = new PluginRegistry()
    const plugin = createMockPlugin('self')

    registry.reserve(plugin)
    registry.complete(plugin)
    registry.requestHookDisable(plugin, [plugin.key])

    expect(() => registry.resolveHookDisables()).toThrow(
      expect.objectContaining({
        code: PluginHostErrorCode.InvalidPluginReference,
      }),
    )
  })

  it('应该拒绝不存在的目标插件', () => {
    const registry = new PluginRegistry()
    const requester = createMockPlugin('requester')

    registry.reserve(requester)
    registry.complete(requester)
    registry.requestHookDisable(requester, ['missing'])

    expect(() => registry.resolveHookDisables()).toThrow(
      expect.objectContaining({
        code: PluginHostErrorCode.InvalidPluginReference,
      }),
    )
  })

  it('应该拒绝重复插件和重复能力', () => {
    const registry = new PluginRegistry()
    const first = createMockPlugin('duplicate')
    const second = createMockPlugin('duplicate')
    const capabilityProvider = createMockPlugin('capability-provider')
    const conflictingProvider = createMockPlugin('conflicting-provider')
    const capability = vi.fn()

    registry.reserve(first)
    expect(() => registry.reserve(second)).toThrow(
      expect.objectContaining({
        code: PluginHostErrorCode.DuplicatePlugin,
      }),
    )

    registry.registerCapability('method', capabilityProvider, capability)

    expect(registry.getCapability('method')).toBe(capability)
    expect(() =>
      registry.registerCapability('method', conflictingProvider, vi.fn()),
    ).toThrow(
      expect.objectContaining({
        code: PluginHostErrorCode.ApiNameConflict,
        details: expect.objectContaining({
          pluginId: 'conflicting-provider',
          registeredPluginId: 'capability-provider',
          registeredPluginPath: '/mock/path/capability-provider',
        }),
      }),
    )
  })

  it('应该用领域错误包装 Hook 启用条件异常', () => {
    const registry = new PluginRegistry()
    const cause = new Error('enablement failed')
    const plugin = createMockPlugin('broken-enablement', {
      enable: () => {
        throw cause
      },
    })

    expect(() => registry.isHookEnabled(plugin)).toThrow(
      expect.objectContaining({
        cause,
        code: PluginHostErrorCode.HookEnablementFailed,
      }),
    )
  })
})
