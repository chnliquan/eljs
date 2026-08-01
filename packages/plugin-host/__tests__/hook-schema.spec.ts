import { describe, expect, expectTypeOf, it } from 'vitest'

import {
  PluginHost,
  PluginHostErrorCode,
  PluginHostState,
  defineAddHook,
  defineEventHook,
  defineHooks,
  defineModifyHook,
  type HookRegistrationApi,
  type HookRunArguments,
  type Plugin,
  type PluginContext,
  type PluginHostOptions,
  type UserConfig,
} from '../src'
import { createMockPlugin } from './setup'

const schema = defineHooks({
  addNames: defineAddHook<{ prefix: string }, string[]>(),
  modifyCount: defineModifyHook<number, { increment: number }>(),
  onDone: defineEventHook<{ count: number }>(),
  onReady: defineEventHook(),
})

const optionalEventArguments: HookRunArguments<(typeof schema)['onReady']> = []
void optionalEventArguments

class TypedPluginHost extends PluginHost<UserConfig, typeof schema> {
  public constructor(options: PluginHostOptions) {
    super(options, schema)
  }

  public createPluginContext(
    plugin: Plugin,
  ): PluginContext<typeof schema, Record<string, unknown>> {
    return (
      this as unknown as {
        _createPluginContext(
          plugin: Plugin,
        ): PluginContext<typeof schema, Record<string, unknown>>
      }
    )._createPluginContext(plugin)
  }

  public setReady(): void {
    ;(
      this as unknown as {
        _state: PluginHostState
      }
    )._state = PluginHostState.Ready
  }

  public accidentalRunnerMethod(): void {}
}

describe('Hook Schema', () => {
  it('应该冻结运行时 Hook 契约', () => {
    expect(Object.isFrozen(schema)).toBe(true)
    expect(schema.modifyCount.kind).toBe('modify')
  })

  it.each(['cwd', 'register', 'toString'])(
    '应该拒绝覆盖核心 Plugin API 的 Hook 名称 %s',
    hookName => {
      const conflictingSchema = defineHooks({
        [hookName]: defineEventHook(),
      })

      class ConflictingHookHost extends PluginHost<
        UserConfig,
        typeof conflictingSchema
      > {
        public constructor(options: PluginHostOptions) {
          super(options, conflictingSchema)
        }
      }

      expect(() => new ConflictingHookHost({ cwd: process.cwd() })).toThrow(
        expect.objectContaining({
          code: PluginHostErrorCode.ApiNameConflict,
        }),
      )
    },
  )

  it.each(['', ' padded '])('应该拒绝无效的 Hook Schema 名称 %j', hookName => {
    const invalidSchema = defineHooks({
      [hookName]: defineEventHook(),
    })

    class InvalidHookHost extends PluginHost<UserConfig, typeof invalidSchema> {
      public constructor(options: PluginHostOptions) {
        super(options, invalidSchema)
      }
    }

    expect(() => new InvalidHookHost({ cwd: process.cwd() })).toThrow(
      expect.objectContaining({
        code: PluginHostErrorCode.InvalidHook,
      }),
    )
  })

  it('应该推导执行结果与插件注册 API', () => {
    type RegistrationApi = HookRegistrationApi<typeof schema>

    expectTypeOf<RegistrationApi['modifyCount']>().toBeFunction()
    expectTypeOf<RegistrationApi['onDone']>().toBeFunction()
  })

  it('应该从 Schema 生成运行时注册方法且不暴露 Runner 方法', async () => {
    const host = new TypedPluginHost({ cwd: process.cwd() })
    const context = host.createPluginContext(createMockPlugin('schema-plugin'))

    expect('modifyCount' in context).toBe(true)
    expect(Object.keys(context)).toContain('modifyCount')
    context.modifyCount((count, { increment }) => count + increment)
    host.setReady()

    await expect(
      host.runHook('modifyCount', {
        initialValue: 1,
        args: { increment: 2 },
      }),
    ).resolves.toBe(3)
    expect(
      (
        context as unknown as {
          accidentalRunnerMethod?: unknown
        }
      ).accidentalRunnerMethod,
    ).toBeUndefined()
  })

  it('提供 Schema 时应该拒绝未声明 Hook 的底层注册', () => {
    const host = new TypedPluginHost({ cwd: process.cwd() })
    const context = host.createPluginContext(createMockPlugin('schema-plugin'))

    expect(() => context.register('missingHook', () => {})).toThrow(
      expect.objectContaining({
        code: PluginHostErrorCode.InvalidHook,
      }),
    )
  })

  it('应该在编译期约束 Hook key、参数和返回值', () => {
    const verify = async (host: TypedPluginHost) => {
      const count = await host.runHook('modifyCount', {
        initialValue: 1,
        args: { increment: 1 },
      })
      expectTypeOf(count).toEqualTypeOf<number>()

      // @ts-expect-error Hook key 必须来自 Schema
      await host.runHook('missingHook')
      await host.runHook('modifyCount', {
        initialValue: 1,
        args: {
          // @ts-expect-error increment 必须是 number
          increment: '1',
        },
      })
    }

    expect(verify).toBeTypeOf('function')
  })
})
