import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import {
  definePlugin,
  definePreset,
  type PluginApi,
  type PluginInitializationResult,
} from '../src'

describe('插件定义辅助函数', () => {
  it('应该原样返回插件初始化器', () => {
    const initializer = vi.fn()

    expect(definePlugin(initializer)).toBe(initializer)
  })

  it('应该原样返回 preset 初始化器', () => {
    const initializer = vi.fn((): PluginInitializationResult => ({
      plugins: ['plugin-a'],
    }))

    expect(definePreset(initializer)).toBe(initializer)
  })

  it('应该推导插件上下文和声明选项', () => {
    interface Options {
      enabled: boolean
    }

    definePlugin<Options>((context, options) => {
      expectTypeOf(context).toEqualTypeOf<PluginApi>()
      expectTypeOf(options).toEqualTypeOf<Options | undefined>()
    })
  })

  it('应该区分 plugin 与 preset 返回值', () => {
    // @ts-expect-error plugin 初始化器不能返回嵌套声明
    definePlugin(() => ({ plugins: ['plugin-a'] }))
    // @ts-expect-error preset 初始化器只能返回声明对象或 void
    definePreset(() => 'invalid')
  })
})
