import { expect, expectTypeOf, it } from 'vitest'

import { getCommandTextOutput, run, runCommandLine } from '../../src/cp/command'

const outputArguments = ['-e', 'process.stdout.write("first\\nsecond")']

it('默认结果保持文本类型', async () => {
  const result = await run(process.execPath, outputArguments)

  expectTypeOf(result.stdout).toEqualTypeOf<string>()
  expect(result.stdout).toBe('first\nsecond')
})

it('二进制编码在两种调用形式中返回 Uint8Array', async () => {
  const result = await run(process.execPath, outputArguments, {
    encoding: 'buffer',
  })
  const optionsOnly = await run(process.execPath, {
    encoding: 'buffer',
    input: 'process.stdout.write("options only")',
  })

  expectTypeOf(result.stdout).toEqualTypeOf<Uint8Array>()
  expectTypeOf(optionsOnly.stdout).toEqualTypeOf<Uint8Array>()
  expect(result.stdout).toBeInstanceOf(Uint8Array)
  expect(Buffer.from(result.stdout).toString()).toBe('first\nsecond')
  expect(Buffer.from(optionsOnly.stdout).toString()).toBe('options only')
})

it('按行输出返回字符串数组', async () => {
  const result = await run(process.execPath, outputArguments, { lines: true })

  expectTypeOf(result.stdout).toEqualTypeOf<string[]>()
  expect(result.stdout).toEqual(['first', 'second'])
})

it('忽略标准输出时结果类型为 undefined', async () => {
  const result = await run(process.execPath, outputArguments, {
    stdout: 'ignore',
  })

  expectTypeOf(result.stdout).toEqualTypeOf<undefined>()
  expect(result.stdout).toBeUndefined()
})

it('命令行调用也保留编码和按行输出类型', async () => {
  const binary = await runCommandLine('node --version', {
    encoding: 'buffer',
    env: { PATH: process.env.PATH },
  })
  const lines = await runCommandLine('node --version', { lines: true })

  expectTypeOf(binary.stdout).toEqualTypeOf<Uint8Array>()
  expectTypeOf(lines.stdout).toEqualTypeOf<string[]>()
  expect(Buffer.from(binary.stdout).toString()).toMatch(/^v\d+\./)
  expect(lines.stdout).toHaveLength(1)
})

it('文本解析入口拒绝非文本输出', () => {
  expect(getCommandTextOutput('text')).toBe('text')

  for (const output of [new Uint8Array([120]), ['line'], undefined]) {
    expect(() => getCommandTextOutput(output)).toThrow(
      'Command output must be text to be parsed',
    )
  }
})
