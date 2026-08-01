import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  PluginHost,
  PluginHostErrorCode,
  PluginHostState,
  type PluginHostOptions,
} from '../src'

class TestPluginHost extends PluginHost {
  public constructor(options: PluginHostOptions) {
    super(options)
  }

  public testLoad(): Promise<void> {
    return this.load()
  }
}

describe('插件宿主集成', () => {
  let cwd: string

  beforeEach(async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-host-'))
    await writeFile(
      path.join(cwd, 'package.json'),
      JSON.stringify({ name: 'host-fixture', type: 'module' }),
    )
  })

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true })
  })

  it('应该在预先取消时停止加载且不进入部分初始化状态', async () => {
    const controller = new AbortController()
    controller.abort(new Error('caller cancelled'))
    const host = new TestPluginHost({ cwd, signal: controller.signal })

    await expect(host.testLoad()).rejects.toMatchObject({
      cause: expect.objectContaining({ message: 'caller cancelled' }),
      code: PluginHostErrorCode.OperationAborted,
    })
    expect(host.state).toBe(PluginHostState.Uninitialized)
  })

  it('应该在 Hook 边界停止后续插件执行', async () => {
    const controller = new AbortController()
    const abortingPlugin = path.join(cwd, 'aborting-plugin.cjs')
    const laterPlugin = path.join(cwd, 'later-plugin.cjs')
    const markerPath = path.join(cwd, 'later-hook-ran.txt')
    await Promise.all([
      writeFile(
        abortingPlugin,
        [
          'module.exports = (context, options) => {',
          "  context.register('onStep', () => options.controller.abort())",
          '}',
        ].join('\n'),
      ),
      writeFile(
        laterPlugin,
        [
          "const fs = require('node:fs')",
          'module.exports = (context, options) => {',
          "  context.register('onStep', () => fs.writeFileSync(options.markerPath, 'ran'))",
          '}',
        ].join('\n'),
      ),
    ])
    const host = new TestPluginHost({
      cwd,
      signal: controller.signal,
      plugins: [
        [abortingPlugin, { controller }],
        [laterPlugin, { markerPath }],
      ],
    })

    await host.testLoad()
    await expect(host.runHook('onStep')).rejects.toMatchObject({
      code: PluginHostErrorCode.OperationAborted,
    })
    await expect(readFile(markerPath, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it('应该加载真实的 ESM、CommonJS 和 TypeScript 插件', async () => {
    const esmPlugin = path.join(cwd, 'esm-plugin.mjs')
    const commonJsPlugin = path.join(cwd, 'common-js-plugin.cjs')
    const commonTypeScriptPlugin = path.join(
      cwd,
      'common-typescript-plugin.cts',
    )
    const typescriptPlugin = path.join(cwd, 'typescript-plugin.ts')
    const typescriptHelper = path.join(cwd, 'typescript-helper.ts')

    await Promise.all([
      writeFile(
        esmPlugin,
        [
          'export default context => {',
          "  context.register('addValues', () => ['esm'])",
          '}',
        ].join('\n'),
      ),
      writeFile(
        commonJsPlugin,
        [
          "module.exports = (context, options = { value: 'default' }) => {",
          "  context.register('addValues', () => [options.value])",
          '}',
        ].join('\n'),
      ),
      writeFile(
        commonTypeScriptPlugin,
        [
          'module.exports = (context: any) => {',
          "  context.register('addValues', () => ['common-typescript'])",
          '}',
        ].join('\n'),
      ),
      writeFile(
        typescriptPlugin,
        [
          "import { value } from './typescript-helper'",
          '',
          'export default (context: any, options: { value: string }) => {',
          "  context.register('addValues', () => [`${value}:${options.value}`])",
          '}',
        ].join('\n'),
      ),
      writeFile(typescriptHelper, "export const value = 'imported'"),
    ])

    const host = new TestPluginHost({
      cwd,
      plugins: [
        esmPlugin,
        commonJsPlugin,
        commonTypeScriptPlugin,
        [typescriptPlugin, { value: 'typescript' }],
      ],
    })

    await host.testLoad()

    await expect(
      host.runHook('addValues', {
        initialValue: [],
      }),
    ).resolves.toEqual([
      'esm',
      'default',
      'common-typescript',
      'imported:typescript',
    ])
  })

  it('应该加载插件初始化期间动态注册的插件', async () => {
    const parentPlugin = path.join(cwd, 'parent-plugin.mjs')
    const childPlugin = path.join(cwd, 'child-plugin.mjs')

    await Promise.all([
      writeFile(
        parentPlugin,
        [
          'export default (context, options) => {',
          '  context.registerPlugins([options.childPlugin])',
          '}',
        ].join('\n'),
      ),
      writeFile(
        childPlugin,
        [
          'export default context => {',
          "  context.register('addValues', () => ['child'])",
          '}',
        ].join('\n'),
      ),
    ])

    const host = new TestPluginHost({
      cwd,
      plugins: [[parentPlugin, { childPlugin }]],
    })

    await host.testLoad()

    expect(host.getPluginDiagnostics().map(plugin => plugin.path)).toEqual([
      parentPlugin,
      childPlugin,
    ])
    await expect(
      host.runHook('addValues', { initialValue: [] }),
    ).resolves.toEqual(['child'])
  })

  it('应该拒绝不受支持的插件扩展名', async () => {
    const unsupportedPlugin = path.join(cwd, 'plugin.mts')
    await writeFile(unsupportedPlugin, 'export default () => {}')
    const host = new TestPluginHost({
      cwd,
      plugins: [unsupportedPlugin],
    })

    await expect(host.testLoad()).rejects.toMatchObject({
      code: PluginHostErrorCode.UnsupportedPluginExtension,
    })
    expect(host.state).toBe(PluginHostState.Failed)
  })

  it('真实插件加载失败后应该清空全部注册数据', async () => {
    const brokenPlugin = path.join(cwd, 'broken-plugin.cjs')
    await writeFile(
      brokenPlugin,
      [
        'module.exports = context => {',
        "  context.register('onBroken', () => {})",
        "  context.registerCapability('brokenMethod', () => {})",
        "  throw new Error('fixture failed')",
        '}',
      ].join('\n'),
    )
    const host = new TestPluginHost({
      cwd,
      plugins: [brokenPlugin],
    })

    await expect(host.testLoad()).rejects.toMatchObject({
      code: PluginHostErrorCode.PluginInitializationFailed,
      details: {
        origin: {
          declaration: brokenPlugin,
          source: 'configuration',
        },
        pluginPath: brokenPlugin,
      },
    })

    expect(host.state).toBe(PluginHostState.Failed)
    expect(host.getPluginDiagnostics()).toEqual([
      expect.objectContaining({
        id: './broken-plugin',
        metrics: expect.objectContaining({
          initializationFailed: true,
        }),
      }),
    ])
  })

  it('插件返回值无效时应该记录初始化失败', async () => {
    const invalidPlugin = path.join(cwd, 'invalid-result-plugin.mjs')
    await writeFile(
      invalidPlugin,
      "export default () => ({ plugins: ['unexpected'] })",
    )
    const host = new TestPluginHost({
      cwd,
      plugins: [invalidPlugin],
    })

    await expect(host.testLoad()).rejects.toMatchObject({
      code: PluginHostErrorCode.InvalidPluginResult,
    })
    expect(host.getPluginDiagnostics()).toEqual([
      expect.objectContaining({
        path: invalidPlugin,
        metrics: expect.objectContaining({
          initializationFailed: true,
        }),
      }),
    ])
  })

  it('应该在嵌套插件错误中保留父 preset 来源', async () => {
    const childPlugin = path.join(cwd, 'nested-broken-plugin.cjs')
    const parentPreset = path.join(cwd, 'parent-preset.cjs')
    await Promise.all([
      writeFile(
        childPlugin,
        "module.exports = () => { throw new Error('nested failed') }",
      ),
      writeFile(
        parentPreset,
        `module.exports = () => ({ plugins: [${JSON.stringify(
          childPlugin,
        )}] })`,
      ),
    ])
    const host = new TestPluginHost({
      cwd,
      presets: [parentPreset],
    })

    await expect(host.testLoad()).rejects.toMatchObject({
      code: PluginHostErrorCode.PluginInitializationFailed,
      details: {
        origin: {
          declaration: childPlugin,
          parentPlugin: {
            path: parentPreset,
            type: 'preset',
          },
          source: 'preset-result',
        },
        pluginPath: childPlugin,
      },
    })
  })
})
