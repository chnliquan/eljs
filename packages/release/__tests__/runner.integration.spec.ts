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

    expect(runner.getPluginDiagnostics()).toHaveLength(6)
  })
})
