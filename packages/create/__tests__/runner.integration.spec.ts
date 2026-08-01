import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { CreateRunner } from '../src/core'

class TestRunner extends CreateRunner {
  public testLoad(): Promise<void> {
    return this.load()
  }
}

describe('CreateRunner 集成', () => {
  let cwd: string

  afterEach(async () => {
    if (cwd) {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('应该通过 Hook Schema 初始化全部内置插件', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-create-runner-'))
    const runner = new TestRunner({ cwd })

    await runner.testLoad()

    expect(runner.getPluginDiagnostics()).toHaveLength(8)
  })

  it('应该在 prompts 就绪后应用包扩展并同步包管理器', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-create-runner-'))
    const target = path.join(cwd, 'review-project')
    const pluginPath = path.join(cwd, 'custom-plugin.cjs')

    await mkdir(target)
    await writeFile(
      path.join(cwd, 'create.config.js'),
      'module.exports = { defaultQuestions: false, gitInit: false, install: true }\n',
    )
    await writeFile(
      pluginPath,
      `module.exports = context => {
  context.modifyPrompts(memo => ({
    ...memo,
    authorName: 'Ender',
    packageManager: 'npm',
  }))
  context.extendPackage(pkg => ({
    ...pkg,
    name: context.appData.projectName,
    author: context.prompts.authorName,
  }))
  context.onGenerateDone(() => {
    context.extendPackage({ description: 'added on generate done' })
  })
  context.onStart(() => {
    if (context.config.install !== false) {
      throw new Error('constructor install option was not applied')
    }
  })
}
`,
    )

    const runner = new CreateRunner({
      cwd,
      install: false,
      plugins: [pluginPath],
    })
    await runner.run(target, 'review-project')

    const packageJson = JSON.parse(
      await readFile(path.join(target, 'package.json'), 'utf8'),
    )
    expect(packageJson).toMatchObject({
      name: 'review-project',
      author: 'Ender',
      description: 'added on generate done',
    })
    expect(runner.appData.pkg).toMatchObject(packageJson)
    expect(runner.appData.packageManager).toBe('npm')
  })
})
