import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  Pluggable,
  PluggableErrorCode,
  PluggableStateEnum,
  type PluggableOptions,
} from '../src'

class TestPluggable extends Pluggable {
  public constructor(options: PluggableOptions) {
    super(options)
  }

  public testLoad(): Promise<void> {
    return this.load()
  }
}

describe('可插拔系统集成', () => {
  let cwd: string

  beforeEach(async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-pluggable-'))
    await writeFile(
      path.join(cwd, 'package.json'),
      JSON.stringify({ name: 'pluggable-fixture', type: 'module' }),
    )
  })

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true })
  })

  it('应该加载真实的 ESM、CommonJS 和 TypeScript 插件', async () => {
    const esmPlugin = path.join(cwd, 'esm-plugin.js')
    const commonJsPlugin = path.join(cwd, 'common-js-plugin.cjs')
    const typescriptPlugin = path.join(cwd, 'typescript-plugin.ts')

    await Promise.all([
      writeFile(
        esmPlugin,
        [
          'export default api => {',
          "  api.register('addValues', () => ['esm'])",
          '}',
        ].join('\n'),
      ),
      writeFile(
        commonJsPlugin,
        [
          "module.exports = (api, options = { value: 'default' }) => {",
          "  api.register('addValues', () => [options.value])",
          '}',
        ].join('\n'),
      ),
      writeFile(
        typescriptPlugin,
        [
          'export default (api: any, options: { value: string }) => {',
          "  api.register('addValues', () => [options.value])",
          '}',
        ].join('\n'),
      ),
    ])

    const pluggable = new TestPluggable({
      cwd,
      plugins: [
        esmPlugin,
        commonJsPlugin,
        [typescriptPlugin, { value: 'typescript' }],
      ],
    })

    await pluggable.testLoad()

    await expect(
      pluggable.applyPlugins<string[], void>('addValues', {
        initialValue: [],
      }),
    ).resolves.toEqual(['esm', 'default', 'typescript'])
  })

  it('应该拒绝不受支持的插件扩展名', async () => {
    const unsupportedPlugin = path.join(cwd, 'plugin.mjs')
    await writeFile(unsupportedPlugin, 'export default () => {}')
    const pluggable = new TestPluggable({
      cwd,
      plugins: [unsupportedPlugin],
    })

    await expect(pluggable.testLoad()).rejects.toMatchObject({
      code: PluggableErrorCode.UnsupportedPluginExtension,
    })
    expect(pluggable.state).toBe(PluggableStateEnum.Failed)
  })

  it('真实插件加载失败后应该清空全部注册数据', async () => {
    const brokenPlugin = path.join(cwd, 'broken-plugin.cjs')
    await writeFile(
      brokenPlugin,
      [
        'module.exports = api => {',
        "  api.register('onBroken', () => {})",
        "  api.registerMethod('brokenMethod', () => {})",
        "  throw new Error('fixture failed')",
        '}',
      ].join('\n'),
    )
    const pluggable = new TestPluggable({
      cwd,
      plugins: [brokenPlugin],
    })

    await expect(pluggable.testLoad()).rejects.toThrow('fixture failed')

    expect(pluggable.state).toBe(PluggableStateEnum.Failed)
    expect(pluggable.plugins).toEqual({})
    expect(pluggable.key2Plugin).toEqual({})
    expect(pluggable.hooks).toEqual({})
    expect(pluggable.pluginMethods).toEqual({})
  })
})
