import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { CreateTemplate, type TemplateConfig } from '../src'

describe('create-template 主路径集成', () => {
  let cwd = ''

  afterEach(async () => {
    if (cwd) {
      await rm(cwd, { recursive: true, force: true })
      cwd = ''
    }
  })

  it('应该通过可注入目录选择本地模版并完成生成', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-create-template-'))
    const templateRoot = path.join(cwd, 'fixture-template')
    await mkdir(templateRoot)
    await writeFile(
      path.join(templateRoot, 'create.config.js'),
      `module.exports = {
  defaultQuestions: false,
  gitInit: false,
  install: false,
  plugins: ['./generate.cjs'],
}
`,
    )
    await writeFile(
      path.join(templateRoot, 'generate.cjs'),
      `const fs = require('node:fs')
const path = require('node:path')

module.exports = context => {
  context.onGenerateFiles(() => {
    fs.writeFileSync(
      path.join(context.paths.target, 'generated.txt'),
      context.appData.projectName + '\\n',
    )
  })
}
`,
    )

    const catalog: TemplateConfig = {
      scenes: { fixture: 'Fixture' },
      templates: {
        fixture: {
          local: {
            type: 'local',
            value: templateRoot,
            description: 'Local Fixture Template',
          },
        },
      },
    }

    await new CreateTemplate({
      cwd,
      scene: 'fixture',
      template: 'local',
      catalog,
    }).run('generated-project')

    await expect(
      readFile(path.join(cwd, 'generated-project', 'generated.txt'), 'utf8'),
    ).resolves.toBe('generated-project\n')
  })
})
