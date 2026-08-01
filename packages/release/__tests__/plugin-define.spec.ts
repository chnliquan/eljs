import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import { definePlugin, definePreset } from '../src/define'
import type { ReleasePluginContext, ReleasePresetContext } from '../src/types'

describe('release 插件定义辅助函数', () => {
  it('应该原样返回初始化器', () => {
    const plugin = vi.fn()
    const preset = vi.fn()

    expect(definePlugin(plugin)).toBe(plugin)
    expect(definePreset(preset)).toBe(preset)
  })

  it('应该推导 release 上下文和声明选项', () => {
    interface Options {
      channel: string
    }

    definePlugin<Options>((context, options) => {
      expectTypeOf(context).toEqualTypeOf<ReleasePluginContext>()
      expectTypeOf(options).toEqualTypeOf<Options | undefined>()
      context.onAfterRelease(() => undefined)
    })
  })

  it('应该区分 plugin 与 preset 返回值', () => {
    // @ts-expect-error plugin 初始化器不能返回嵌套声明
    definePlugin(() => ({ plugins: ['plugin-a'] }))
    definePreset(context => {
      expectTypeOf(context).toEqualTypeOf<ReleasePresetContext>()
      context.registerPlugins(['plugin-a'])
      return { plugins: ['plugin-a'] }
    })
  })
})
