import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import type { StandardSchemaV1 } from '@eljs/plugin-host'
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

  it('应该从 Schema 推导 create 插件和 preset 的解析后参数', () => {
    const optionsSchema: StandardSchemaV1<{ target: string }, { target: URL }> =
      {
        '~standard': {
          validate(value) {
            return {
              value: {
                target: new URL((value as { target: string }).target),
              },
            }
          },
          vendor: 'test',
          version: 1,
        },
      }

    definePlugin({
      optionsSchema,
      initialize(context, options) {
        expectTypeOf(context).toEqualTypeOf<CreatePluginContext>()
        expectTypeOf(options).toEqualTypeOf<{ target: URL }>()
      },
    })
    definePreset({
      optionsSchema,
      initialize(context, options) {
        expectTypeOf(context).toEqualTypeOf<CreatePresetContext>()
        expectTypeOf(options).toEqualTypeOf<{ target: URL }>()
      },
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

  it('对象形式应该约束 Schema 输出和初始化器返回值', () => {
    const optionsSchema: StandardSchemaV1<{ target: string }, { target: URL }> =
      {
        '~standard': {
          validate(value) {
            return {
              value: {
                target: new URL((value as { target: string }).target),
              },
            }
          },
          vendor: 'test',
          version: 1,
        },
      }
    const invalidOptionsInitializer = (
      _context: CreatePluginContext,
      _options: { target: string },
    ) => undefined
    const invalidPluginResult = (
      _context: CreatePluginContext,
      _options: { target: URL },
    ) => ({ plugins: ['plugin-a'] })
    const invalidPresetResult = (
      _context: CreatePresetContext,
      _options: { target: URL },
    ) => 'invalid'

    const verify = () => {
      definePlugin<typeof optionsSchema>({
        // @ts-expect-error create 插件参数必须使用 Schema 输出类型
        initialize: invalidOptionsInitializer,
        optionsSchema,
      })
      definePlugin<typeof optionsSchema>({
        // @ts-expect-error 对象形式的 create plugin 不能返回嵌套声明
        initialize: invalidPluginResult,
        optionsSchema,
      })
      definePreset<typeof optionsSchema>({
        // @ts-expect-error 对象形式的 create preset 只能返回声明对象或 void
        initialize: invalidPresetResult,
        optionsSchema,
      })
    }

    expect(verify).toBeTypeOf('function')
  })
})
