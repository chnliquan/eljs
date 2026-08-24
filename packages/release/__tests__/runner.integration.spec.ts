import { PluginHostErrorCode, PluginHostState } from '@eljs/plugin-host'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { ReleaseRunner } from '../src/release-runner'

class TestRunner extends ReleaseRunner {
  public testLoad(): Promise<void> {
    return this.load()
  }
}

describe('ReleaseRunner 集成', () => {
  let cwd: string

  afterEach(async () => {
    if (cwd) {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('应该通过 Hook Schema 初始化全部内置插件', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-runner-'))
    await writeFile(
      path.join(cwd, 'package.json'),
      JSON.stringify({ name: 'release-fixture', version: '1.0.0' }),
    )
    const runner = new TestRunner({ cwd })

    await runner.testLoad()

    expect(runner.state).toBe(PluginHostState.Ready)
  })

  it('取消正常生命周期后仍应该执行 onError 清理 Hook', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-release-runner-abort-'))
    await writeFile(
      path.join(cwd, 'package.json'),
      JSON.stringify({ name: 'release-abort-fixture', version: '1.0.0' }),
    )
    const controller = new AbortController()
    const controllerKey = `__eljsReleaseAbortController${Date.now()}`
    const cleanupKey = `__eljsReleaseAbortCleanup${Date.now()}`
    const pluginPath = path.join(cwd, 'abort-plugin.mjs')
    Reflect.set(globalThis, controllerKey, controller)
    Reflect.set(globalThis, cleanupKey, false)
    await writeFile(
      pluginPath,
      [
        'export default context => {',
        '  context.modifyConfig(config => {',
        `    Reflect.get(globalThis, ${JSON.stringify(controllerKey)}).abort(new Error('fixture cancelled'))`,
        '    return config',
        '  })',
        '  context.onError(() => {',
        `    Reflect.set(globalThis, ${JSON.stringify(cleanupKey)}, true)`,
        '  })',
        '}',
      ].join('\n'),
    )

    try {
      const runner = new ReleaseRunner({
        cwd,
        dryRun: true,
        signal: controller.signal,
        plugins: [pluginPath],
      })

      await expect(runner.run()).rejects.toMatchObject({
        code: PluginHostErrorCode.OperationAborted,
      })
      expect(Reflect.get(globalThis, cleanupKey)).toBe(true)
      expect(runner.stage).toBe('failed')
    } finally {
      Reflect.deleteProperty(globalThis, controllerKey)
      Reflect.deleteProperty(globalThis, cleanupKey)
    }
  })
})
