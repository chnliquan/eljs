import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { z } from 'zod'

import {
  definePlugin,
  definePreset,
  PluginHostErrorCode,
  type InferInitializerOptionsInput,
  type InferInitializerOptionsOutput,
  type PluginApi,
  type PluginInitializationResult,
  type StandardSchemaV1,
} from '../src'

function createOptionsSchema<Input, Output>(
  validate: StandardSchemaV1<Input, Output>['~standard']['validate'],
): StandardSchemaV1<Input, Output> {
  return {
    '~standard': {
      validate,
      vendor: 'test',
      version: 1,
    },
  }
}

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

  it('应该为对象形式的插件和 preset 附加只读参数 Schema', () => {
    const optionsSchema = createOptionsSchema(value => ({ value }))
    const pluginInitializer = vi.fn()
    const presetInitializer = vi.fn()

    const plugin = definePlugin({
      initialize: pluginInitializer,
      optionsSchema,
    })
    const preset = definePreset({
      initialize: presetInitializer,
      optionsSchema,
    })

    expect(plugin).toBe(pluginInitializer)
    expect(preset).toBe(presetInitializer)
    expect(plugin.optionsSchema).toBe(optionsSchema)
    expect(preset.optionsSchema).toBe(optionsSchema)
    expect(Object.keys(plugin)).not.toContain('optionsSchema')
    expect(Object.getOwnPropertyDescriptor(plugin, 'optionsSchema')).toEqual(
      expect.objectContaining({
        configurable: false,
        enumerable: false,
        writable: false,
      }),
    )
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

  it('应该从 Schema 区分用户输入和初始化器参数类型', () => {
    const optionsSchema = createOptionsSchema<
      { count: string },
      { count: number }
    >(value => ({
      value: {
        count: Number((value as { count: string }).count),
      },
    }))

    const _plugin = definePlugin({
      optionsSchema,
      initialize(context, options) {
        expectTypeOf(context).toEqualTypeOf<PluginApi>()
        expectTypeOf(options).toEqualTypeOf<{ count: number }>()
      },
    })

    expectTypeOf<InferInitializerOptionsInput<typeof _plugin>>().toEqualTypeOf<{
      count: string
    }>()
    expectTypeOf<
      InferInitializerOptionsOutput<typeof _plugin>
    >().toEqualTypeOf<{ count: number }>()
  })

  it('应该从 Zod Schema 推导输入和输出类型', () => {
    const optionsSchema = z.object({
      count: z.string().transform(Number),
      enabled: z.boolean().default(true),
    })

    const _plugin = definePlugin({
      optionsSchema,
      initialize(_context, options) {
        expectTypeOf(options).toEqualTypeOf<z.output<typeof optionsSchema>>()
      },
    })

    expectTypeOf<InferInitializerOptionsInput<typeof _plugin>>().toEqualTypeOf<
      z.input<typeof optionsSchema>
    >()
    expectTypeOf<InferInitializerOptionsOutput<typeof _plugin>>().toEqualTypeOf<
      z.output<typeof optionsSchema>
    >()
  })

  it('对象形式应该保留宿主扩展的插件上下文类型', () => {
    interface CustomPluginContext extends PluginApi {
      onStart(handler: () => void): void
    }
    const optionsSchema = createOptionsSchema(value => ({ value }))

    definePlugin({
      optionsSchema,
      initialize(context: CustomPluginContext) {
        expectTypeOf(context).toEqualTypeOf<CustomPluginContext>()
      },
    })
  })

  it('应该在编译期约束对象形式的 Schema 和初始化器参数', () => {
    const optionsSchema = z.object({ count: z.number() })
    const invalidInitializer = (
      _context: PluginApi,
      _options: { count: string },
    ) => undefined

    const verify = () => {
      definePlugin<typeof optionsSchema>({
        // @ts-expect-error 初始化器参数必须使用 Schema 输出类型
        initialize: invalidInitializer,
        optionsSchema,
      })
    }

    expect(verify).toBeTypeOf('function')
  })

  it('应该在编译期和运行时拒绝无效的对象形式定义', () => {
    const initialize = vi.fn()

    expect(() =>
      // @ts-expect-error optionsSchema 必须实现 Standard Schema V1
      definePlugin({ initialize, optionsSchema: {} }),
    ).toThrow(
      expect.objectContaining({
        code: PluginHostErrorCode.InvalidOptions,
      }),
    )
    expect(() =>
      // @ts-expect-error 对象形式必须同时提供 optionsSchema
      definePlugin({ initialize }),
    ).toThrow(
      expect.objectContaining({
        code: PluginHostErrorCode.InvalidOptions,
      }),
    )
  })

  it('应该区分 plugin 与 preset 返回值', () => {
    // @ts-expect-error plugin 初始化器不能返回嵌套声明
    definePlugin(() => ({ plugins: ['plugin-a'] }))
    // @ts-expect-error preset 初始化器只能返回声明对象或 void
    definePreset(() => 'invalid')

    const optionsSchema = z.undefined()
    const invalidPluginInitializer = () => ({ plugins: ['plugin-a'] })
    const invalidPresetInitializer = () => 'invalid'

    const verifyObjectDefinitions = () => {
      definePlugin<typeof optionsSchema>({
        // @ts-expect-error 对象形式的 plugin 初始化器不能返回嵌套声明
        initialize: invalidPluginInitializer,
        optionsSchema,
      })
      definePreset<typeof optionsSchema>({
        // @ts-expect-error 对象形式的 preset 初始化器只能返回声明对象或 void
        initialize: invalidPresetInitializer,
        optionsSchema,
      })
    }

    expect(verifyObjectDefinitions).toBeTypeOf('function')
  })
})
