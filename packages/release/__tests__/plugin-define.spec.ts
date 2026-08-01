import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import type { StandardSchemaV1 } from '@eljs/plugin-host'
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

  it('应该从 Schema 推导 release 插件和 preset 的解析后参数', () => {
    const optionsSchema: StandardSchemaV1<
      { channel: string },
      { channel: 'next' | 'latest' }
    > = {
      '~standard': {
        validate(value) {
          return {
            value: value as { channel: 'next' | 'latest' },
          }
        },
        vendor: 'test',
        version: 1,
      },
    }

    definePlugin({
      optionsSchema,
      initialize(context, options) {
        expectTypeOf(context).toEqualTypeOf<ReleasePluginContext>()
        expectTypeOf(options).toEqualTypeOf<{
          channel: 'next' | 'latest'
        }>()
      },
    })
    definePreset({
      optionsSchema,
      initialize(context, options) {
        expectTypeOf(context).toEqualTypeOf<ReleasePresetContext>()
        expectTypeOf(options).toEqualTypeOf<{
          channel: 'next' | 'latest'
        }>()
      },
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

  it('对象形式应该约束 Schema 输出和初始化器返回值', () => {
    const optionsSchema: StandardSchemaV1<
      { channel: string },
      { channel: 'next' | 'latest' }
    > = {
      '~standard': {
        validate(value) {
          return {
            value: value as { channel: 'next' | 'latest' },
          }
        },
        vendor: 'test',
        version: 1,
      },
    }
    const invalidOptionsInitializer = (
      _context: ReleasePluginContext,
      _options: { channel: number },
    ) => undefined
    const invalidPluginResult = (
      _context: ReleasePluginContext,
      _options: { channel: 'next' | 'latest' },
    ) => ({ plugins: ['plugin-a'] })
    const invalidPresetResult = (
      _context: ReleasePresetContext,
      _options: { channel: 'next' | 'latest' },
    ) => 'invalid'

    const verify = () => {
      definePlugin<typeof optionsSchema>({
        // @ts-expect-error release 插件参数必须使用 Schema 输出类型
        initialize: invalidOptionsInitializer,
        optionsSchema,
      })
      definePlugin<typeof optionsSchema>({
        // @ts-expect-error 对象形式的 release plugin 不能返回嵌套声明
        initialize: invalidPluginResult,
        optionsSchema,
      })
      definePreset<typeof optionsSchema>({
        // @ts-expect-error 对象形式的 release preset 只能返回声明对象或 void
        initialize: invalidPresetResult,
        optionsSchema,
      })
    }

    expect(verify).toBeTypeOf('function')
  })
})
