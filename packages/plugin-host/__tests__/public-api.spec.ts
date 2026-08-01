import { describe, expect, it } from 'vitest'

import * as publicApi from '../src'

describe('公共 API', () => {
  it('应该导出稳定的运行时入口', () => {
    expect(publicApi).toMatchObject({
      Hook: expect.any(Function),
      PluginHost: expect.any(Function),
      PluginHostState: expect.any(Object),
      PluginHostError: expect.any(Function),
      Plugin: expect.any(Function),
      PluginApi: expect.any(Function),
      defineHooks: expect.any(Function),
      definePlugin: expect.any(Function),
      definePreset: expect.any(Function),
    })
  })

  it('不应该从根入口暴露内部运行时组件', () => {
    expect(publicApi).not.toHaveProperty('HookExecutor')
    expect(publicApi).not.toHaveProperty('HookRegistry')
    expect(publicApi).not.toHaveProperty('PluginRegistry')
    expect(publicApi).not.toHaveProperty('loadPluginInitializer')
    expect(publicApi).not.toHaveProperty('resolvePluginDeclarations')
  })

  it('不应该继续暴露已经替换的模糊 API 名称', () => {
    expect(publicApi).not.toHaveProperty('ApplyPluginTypeEnum')
    expect(publicApi).not.toHaveProperty('PluginTypeEnum')
    expect(publicApi).not.toHaveProperty('PluginRuntime')
    expect(publicApi).not.toHaveProperty('PluginRuntimeState')
  })
})
