import { expect, expectTypeOf, it } from 'vitest'

import { run, type RunCommandOptions } from '../../src/cp'

async function runWithDynamicOptions(options: RunCommandOptions) {
  return run(
    process.execPath,
    ['-e', 'process.stdout.write("dynamic output")'],
    options,
  )
}

it('公开入口保留动态选项可能返回的文本和二进制输出', async () => {
  type Output = Awaited<ReturnType<typeof runWithDynamicOptions>>['stdout']
  expectTypeOf<Output>().extract<string>().toEqualTypeOf<string>()
  expectTypeOf<Output>().extract<Uint8Array>().toEqualTypeOf<Uint8Array>()
  expectTypeOf<Output>().extract<undefined>().toEqualTypeOf<undefined>()

  const text = await runWithDynamicOptions({})
  const binary = await runWithDynamicOptions({ encoding: 'buffer' })
  expect(text.stdout).toBe('dynamic output')
  expect(binary.stdout).toBeInstanceOf(Uint8Array)
})

it('公开入口准确推导明确指定的输出编码', async () => {
  const result = await run(process.execPath, ['--version'], {
    encoding: 'buffer',
  })

  expectTypeOf(result.stdout).toEqualTypeOf<Uint8Array>()
  expect(Buffer.from(result.stdout).toString()).toMatch(/^v\d+\./)
})
