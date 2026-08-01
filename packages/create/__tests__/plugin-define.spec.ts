import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import { definePlugin, definePreset } from '../src/define'
import type { CreatePluginContext, CreatePresetContext } from '../src/types'

describe('create 插件定义辅助函数', () => {
  it('应该原样返回初始化器', () => {
    const plugin = vi.fn()
    const preset = vi.fn()

    expect(definePlugin(plugin)).toBe(plugin)
    expect(definePreset(preset)).toBe(preset)
  })

  it('应该推导 create 上下文和声明选项', () => {
    interface Options {
      template: string
    }

    definePlugin<Options>((context, options) => {
      expectTypeOf(context).toEqualTypeOf<CreatePluginContext>()
      expectTypeOf(options).toEqualTypeOf<Options | undefined>()
      context.onGenerateDone(() => undefined)
    })
  })

  it('应该区分 plugin 与 preset 返回值', () => {
    // @ts-expect-error plugin 初始化器不能返回嵌套声明
    definePlugin(() => ({ plugins: ['plugin-a'] }))
    definePreset(context => {
      expectTypeOf(context).toEqualTypeOf<CreatePresetContext>()
      context.registerPlugins(['plugin-a'])
      return { plugins: ['plugin-a'] }
    })
  })
})
