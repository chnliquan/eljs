import readline from 'node:readline'
import { PassThrough } from 'node:stream'
import prompts, { type PromptObject } from 'prompts'
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

import * as cli from '../../src/cli'
import { confirm, loopPrompt, pause, prompt, select } from '../../src/cli'

afterEach(() => {
  delete (prompts as typeof prompts & { _injected?: unknown[] })._injected
  prompts.override({})
  vi.restoreAllMocks()
})

it('导出 CLI 公共入口', () => {
  for (const name of [
    'pause',
    'confirm',
    'select',
    'prompt',
    'loopPrompt',
    'runCliProcess',
    'notifyUpdates',
  ] as const) {
    expect(cli[name]).toBeTypeOf('function')
  }
  expect(cli.prompts).toBe(prompts)
})

describe('pause 的真实 readline 生命周期', () => {
  function setup() {
    const input = new PassThrough()
    const output = new PassThrough()
    const rl = readline.createInterface({ input, output, terminal: false })
    vi.spyOn(readline, 'createInterface').mockReturnValueOnce(rl)
    const close = vi.spyOn(rl, 'close')
    const assertClean = () => {
      expect(rl.listenerCount('close')).toBe(0)
      expect(rl.listenerCount('error')).toBe(0)
      expect(input.listenerCount('error')).toBe(0)
      expect(input.listenerCount('data')).toBe(0)
      expect(input.listenerCount('end')).toBe(0)
      expect(close).toHaveBeenCalledTimes(1)
      input.destroy()
      output.destroy()
    }
    return { input, output, rl, assertClean }
  }

  it.each([undefined, '按 Enter 继续'])(
    '正常 Enter 完成输入并清理，提示为 %s',
    async message => {
      const { input, output, assertClean } = setup()
      const result = pause(message)
      expect(output.read()?.toString()).toBe(
        message ?? 'Press Enter key to continue...',
      )
      input.write('\n')
      await expect(result).resolves.toBeUndefined()
      assertClean()
    },
  )

  it('stdin EOF 拒绝而不留下悬空 Promise', async () => {
    const { input, assertClean } = setup()
    const result = expect(pause()).rejects.toThrow(
      'Input closed before pause received a line',
    )
    input.end()
    await result
    assertClean()
  })

  it('外部关闭 readline 时拒绝并清理一次', async () => {
    const { rl, assertClean } = setup()
    const result = expect(pause()).rejects.toThrow('Input closed')
    rl.close()
    await result
    assertClean()
  })

  it('输入流错误保留错误原因并清理', async () => {
    const { input, assertClean } = setup()
    const error = new Error('stdin failed')
    const result = expect(pause()).rejects.toBe(error)
    input.destroy(error)
    await result
    assertClean()
  })
})

describe('confirm 的真实取消行为和返回类型', () => {
  it.each([true, false])('返回用户选择 %s', async answer => {
    prompts.inject([answer])
    const result = confirm('继续？')
    expectTypeOf(result).toEqualTypeOf<Promise<boolean>>()
    await expect(result).resolves.toBe(answer)
  })

  it.each([true, false])('保留 preferNo=%s 的默认值', async preferNo => {
    prompts.inject([undefined])
    await expect(confirm('继续？', preferNo)).resolves.toBe(!preferNo)
  })

  it('默认取消拒绝且不退出进程', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Unexpected exit')
    })
    prompts.inject([new Error('cancel')])
    await expect(confirm('继续？', undefined, undefined)).rejects.toThrow(
      'Prompt was cancelled',
    )
    expect(exit).not.toHaveBeenCalled()
  })

  it('自定义取消回调正常返回时保留 undefined', async () => {
    const onCancel = vi.fn(() => {})
    prompts.inject([new Error('cancel')])
    const result = confirm('继续？', true, onCancel)
    expectTypeOf(result).toEqualTypeOf<Promise<boolean | undefined>>()
    await expect(result).resolves.toBeUndefined()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('保留自定义取消回调抛出的错误', async () => {
    const error = new Error('domain cancellation')
    prompts.inject([new Error('cancel')])
    await expect(
      confirm('继续？', undefined, () => {
        throw error
      }),
    ).rejects.toBe(error)
  })
})

describe('select 值类型', () => {
  it('推导字符串、数字和对象的值并原样返回', async () => {
    const object = { id: 1 }
    prompts.inject(['one', 2, object])
    const text = select('文本', [{ title: 'one', value: 'one' }])
    expectTypeOf(text).toEqualTypeOf<Promise<string>>()
    await expect(text).resolves.toBe('one')
    const number = select('数字', [{ title: 'two', value: 2 }])
    expectTypeOf(number).toEqualTypeOf<Promise<number>>()
    await expect(number).resolves.toBe(2)
    const record = select('对象', [{ title: 'object', value: object }])
    expectTypeOf(record).toEqualTypeOf<Promise<{ id: number }>>()
    await expect(record).resolves.toBe(object)
  })

  it('推导动态选项值并支持显式值联合类型', async () => {
    prompts.inject([3, 'one'])
    const result = select('动态', () => [{ title: 'three', value: 3 }])
    expectTypeOf(result).toEqualTypeOf<Promise<number>>()
    await expect(result).resolves.toBe(3)
    const mixed = select<string | number>('混合', [
      { title: 'one', value: 'one' },
      { title: 'two', value: 2 },
    ])
    expectTypeOf(mixed).toEqualTypeOf<Promise<string | number>>()
    await expect(mixed).resolves.toBe('one')
  })

  it('取消选择时拒绝', async () => {
    prompts.inject([new Error('cancel')])
    await expect(select('选择', [{ title: 'one', value: 1 }])).rejects.toThrow(
      'Prompt was cancelled',
    )
  })
})

// 编译期验证显式泛型约束选项值，不启动交互
function checkSelectTypes() {
  // @ts-expect-error 数字选项不能声明为字符串返回值
  void select<string>('选择', [{ title: 'one', value: 1 }])
  const missing = select('默认索引', [{ title: 'one' }])
  expectTypeOf(missing).toEqualTypeOf<Promise<unknown>>()
  const index = select('默认索引', [{ title: 'one', value: undefined }])
  expectTypeOf(index).toEqualTypeOf<Promise<number>>()
}
void checkSelectTypes

describe('prompt 的真实提问流程', () => {
  it('仅默认 undefined，保留静态和动态的跳过类型', async () => {
    const questions: PromptObject[] = [
      { name: 'skipFalse', type: false },
      { name: 'skipNull', type: null },
      { name: 'skipDynamic', type: () => false },
      { name: 'default', type: undefined, message: '文本' },
      { name: 'next', type: 'number', message: '数字' },
    ]
    prompts.inject(['value', 42])
    await expect(prompt(questions)).resolves.toEqual({
      default: 'value',
      next: 42,
    })
    expect(questions[3].type).toBeUndefined()
    expect(questions[2].type).toBeTypeOf('function')
  })

  it('保留 falsy 初始值且不修改问题定义', async () => {
    const questions: PromptObject[] = [
      { name: 'enabled', type: 'confirm', message: '启用' },
      { name: 'count', type: 'number', message: '数量' },
      { name: 'label', type: 'text', message: '名称' },
    ]
    prompts.inject([undefined, undefined, undefined])
    await expect(
      prompt(questions, { enabled: false, count: 0, label: '' }),
    ).resolves.toEqual({ enabled: false, count: 0, label: '' })
    expect(questions.every(question => question.initial === undefined)).toBe(
      true,
    )
  })

  it('取消后拒绝而不返回部分答案', async () => {
    prompts.inject(['partial', new Error('cancel')])
    await expect(
      prompt([
        { name: 'first', type: 'text', message: '第一题' },
        { name: 'second', type: 'text', message: '第二题' },
      ]),
    ).rejects.toThrow('Prompt was cancelled')
  })
})

describe('loopPrompt 摘要脱敏', () => {
  it('掩码整个敏感答案，包括动态类型、名称、样式和格式化对象', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const secret = { token: 'formatted-secret' }
    const dynamicType = vi.fn(() => 'password' as const)
    const dynamicName = vi.fn(() => 'dynamic')
    const questions: PromptObject[] = [
      { name: 'public', type: 'text', message: '公开' },
      { name: 'password', type: 'password', message: '密码' },
      { name: 'hidden', type: 'invisible', message: '隐藏' },
      { name: dynamicName, type: dynamicType, message: '动态密码' },
      {
        name: 'formatted',
        type: 'password',
        message: '格式化密码',
        format: () => secret,
      },
      {
        name: 'styled',
        type: 'text',
        style: () => 'invisible',
        message: '隐藏样式',
      },
    ]
    prompts.inject([
      'visible',
      'raw-password',
      'hidden-token',
      'dynamic-secret',
      'raw-formatted-secret',
      'styled-secret',
      true,
    ])
    const answers = await loopPrompt(questions)
    expect(answers).toEqual({
      public: 'visible',
      password: 'raw-password',
      hidden: 'hidden-token',
      dynamic: 'dynamic-secret',
      formatted: secret,
      styled: 'styled-secret',
    })
    expect(answers.formatted).toBe(secret)
    expect(JSON.parse(log.mock.calls[2][0])).toEqual({
      public: 'visible',
      password: '******',
      hidden: '******',
      dynamic: '******',
      formatted: '******',
      styled: '******',
    })
    expect(dynamicType).toHaveBeenCalledOnce()
    expect(dynamicName).toHaveBeenCalledOnce()
    expect(questions[3].type).toBe(dynamicType)
    expect(questions[3].name).toBe(dynamicName)
  })

  it('重新输入时重新解析动态类型，保留真实初始答案', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const type = vi
      .fn<() => 'text' | 'password'>()
      .mockReturnValueOnce('text')
      .mockReturnValueOnce('password')
    prompts.inject(['first', false, undefined, true])
    const result = await loopPrompt([{ name: 'value', type, message: '内容' }])
    expect(result).toEqual({ value: 'first' })
    expect(type).toHaveBeenCalledTimes(2)
    expect(JSON.parse(log.mock.calls[2][0])).toEqual({ value: 'first' })
    expect(JSON.parse(log.mock.calls[6][0])).toEqual({ value: '******' })
  })

  it('密码重新输入的初始值保持原值', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    prompts.inject(['secret', false, undefined, true])
    await expect(
      loopPrompt([{ name: 'password', type: 'password', message: '密码' }]),
    ).resolves.toEqual({ password: 'secret' })
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret')
  })

  it('确认阶段取消时拒绝', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    prompts.inject(['value', new Error('cancel')])
    await expect(
      loopPrompt([{ name: 'name', type: 'text', message: '姓名' }]),
    ).rejects.toThrow('Prompt was cancelled')
  })
})
