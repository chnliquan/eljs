import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { ProjectCreator } from '../src/core'

describe('ProjectCreator 目标恢复集成', () => {
  const abortControllerKey = '__eljsProjectCreatorAbortController'
  let cwd = ''

  afterEach(async () => {
    Reflect.deleteProperty(globalThis, abortControllerKey)
    if (cwd) {
      await rm(cwd, { recursive: true, force: true })
      cwd = ''
    }
  })

  it('应该在模板预检失败时保留原目标', async () => {
    const fixture = await createFixture()

    await expect(
      new ProjectCreator({
        cwd,
        template: fixture.templateRoot,
        force: true,
      }).run('project'),
    ).rejects.toThrow('Invalid template')

    await expect(readFile(fixture.originalFile, 'utf8')).resolves.toBe(
      'original\n',
    )
  })

  it('应该在预先取消时不触碰现有目标目录', async () => {
    const fixture = await createFixture()
    const controller = new AbortController()
    controller.abort(new Error('caller cancelled'))

    await expect(
      new ProjectCreator({
        cwd,
        template: fixture.templateRoot,
        force: true,
        signal: controller.signal,
      }).run('project'),
    ).rejects.toThrow('was aborted')

    await expect(readFile(fixture.originalFile, 'utf8')).resolves.toBe(
      'original\n',
    )
  })

  it('应该在生成失败时删除部分结果并恢复原目标', async () => {
    const fixture = await createFixture()
    await writeFile(
      path.join(fixture.templateRoot, 'create.config.js'),
      `module.exports = {
  defaultQuestions: false,
  gitInit: false,
  install: false,
  plugins: ['./fail.cjs'],
}
`,
    )
    await writeFile(
      path.join(fixture.templateRoot, 'fail.cjs'),
      `const fs = require('node:fs')
const path = require('node:path')

module.exports = context => {
  context.onGenerateFiles(() => {
    fs.writeFileSync(path.join(context.paths.target, 'partial.txt'), 'partial\\n')
    throw new Error('fixture generation failed')
  })
}
`,
    )

    await expect(
      new ProjectCreator({
        cwd,
        template: fixture.templateRoot,
        force: true,
      }).run('project'),
    ).rejects.toThrow('fixture generation failed')

    await expect(readFile(fixture.originalFile, 'utf8')).resolves.toBe(
      'original\n',
    )
    await expect(
      readFile(path.join(fixture.targetRoot, 'partial.txt'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('应该在覆盖生成期间取消时恢复原目标', async () => {
    const fixture = await createFixture()
    const controller = new AbortController()
    Reflect.set(globalThis, abortControllerKey, controller)
    await writeFile(
      path.join(fixture.templateRoot, 'create.config.js'),
      `module.exports = {
  defaultQuestions: false,
  gitInit: false,
  install: false,
  plugins: ['./cancel.cjs'],
}
`,
    )
    await writeFile(
      path.join(fixture.templateRoot, 'cancel.cjs'),
      `const fs = require('node:fs')
const path = require('node:path')

module.exports = context => {
  context.onGenerateFiles(() => {
    fs.writeFileSync(path.join(context.paths.target, 'partial.txt'), 'partial\\n')
    globalThis.${abortControllerKey}.abort(new Error('fixture cancelled'))
  })
}
`,
    )

    await expect(
      new ProjectCreator({
        cwd,
        template: fixture.templateRoot,
        force: true,
        signal: controller.signal,
      }).run('project'),
    ).rejects.toThrow('was aborted')

    await expect(readFile(fixture.originalFile, 'utf8')).resolves.toBe(
      'original\n',
    )
    await expect(
      readFile(path.join(fixture.targetRoot, 'partial.txt'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('应该在 merge 生成失败时完整恢复原目标', async () => {
    const fixture = await createFixture()
    await writeFile(
      path.join(fixture.templateRoot, 'create.config.js'),
      `module.exports = {
  defaultQuestions: false,
  gitInit: false,
  install: false,
  plugins: ['./fail.cjs'],
}
`,
    )
    await writeFile(
      path.join(fixture.templateRoot, 'fail.cjs'),
      `const fs = require('node:fs')
const path = require('node:path')

module.exports = context => {
  context.onGenerateFiles(() => {
    fs.writeFileSync(path.join(context.paths.target, 'partial.txt'), 'partial\\n')
    fs.writeFileSync(path.join(context.paths.target, 'original.txt'), 'changed\\n')
    throw new Error('fixture merge failed')
  })
}
`,
    )

    await expect(
      new ProjectCreator({
        cwd,
        template: fixture.templateRoot,
        merge: true,
      }).run('project'),
    ).rejects.toThrow('fixture merge failed')

    await expect(readFile(fixture.originalFile, 'utf8')).resolves.toBe(
      'original\n',
    )
    await expect(
      readFile(path.join(fixture.targetRoot, 'partial.txt'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('应该拒绝通过工作目录内的符号链接写出真实工作目录', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-project-boundary-'))
    const workspaceRoot = path.join(cwd, 'workspace')
    const outsideRoot = path.join(cwd, 'outside')
    const templateRoot = path.join(cwd, 'template')
    await Promise.all([
      mkdir(workspaceRoot),
      mkdir(outsideRoot),
      mkdir(templateRoot),
    ])
    await writeFile(
      path.join(templateRoot, 'create.config.js'),
      'module.exports = { defaultQuestions: false, gitInit: false, install: false }\n',
    )
    await symlink(
      outsideRoot,
      path.join(workspaceRoot, 'linked'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )

    await expect(
      new ProjectCreator({
        cwd: workspaceRoot,
        template: templateRoot,
        force: true,
      }).run('linked/project'),
    ).rejects.toMatchObject({ code: 'CREATE_INVALID_PROJECT_NAME' })
  })

  it('通过目标符号链接覆盖时应该保持锁与事务使用同一物理路径', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-project-alias-'))
    const targetRoot = path.join(cwd, 'physical-project')
    const targetAlias = path.join(cwd, 'project')
    const templateRoot = path.join(cwd, 'template')
    const originalFile = path.join(targetRoot, 'original.txt')
    await Promise.all([mkdir(targetRoot), mkdir(templateRoot)])
    await writeFile(originalFile, 'original\n')
    await writeFile(
      path.join(templateRoot, 'create.config.js'),
      'module.exports = { defaultQuestions: false, gitInit: false, install: false }\n',
    )
    await symlink(
      targetRoot,
      targetAlias,
      process.platform === 'win32' ? 'junction' : 'dir',
    )

    await new ProjectCreator({
      cwd,
      template: templateRoot,
      force: true,
    }).run('project')

    expect((await lstat(targetAlias)).isSymbolicLink()).toBe(true)
    await expect(readFile(originalFile, 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it('merge 目标不是目录时应该拒绝并保留原文件', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-project-file-'))
    const targetFile = path.join(cwd, 'project')
    const templateRoot = path.join(cwd, 'template')
    await mkdir(templateRoot)
    await writeFile(targetFile, 'original\n')
    await writeFile(
      path.join(templateRoot, 'create.config.js'),
      'module.exports = { defaultQuestions: false, gitInit: false, install: false }\n',
    )

    await expect(
      new ProjectCreator({
        cwd,
        template: templateRoot,
        merge: true,
      }).run('project'),
    ).rejects.toMatchObject({ code: 'CREATE_INVALID_OPTIONS' })

    await expect(readFile(targetFile, 'utf8')).resolves.toBe('original\n')
  })

  it('工作目录不存在时应该抛出稳定领域错误', async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-project-cwd-'))
    const missingCwd = path.join(cwd, 'missing')

    await expect(
      new ProjectCreator({
        cwd: missingCwd,
        template: './template',
      }).run('project'),
    ).rejects.toMatchObject({
      code: 'CREATE_INVALID_OPTIONS',
      details: { cwd: missingCwd },
    })
  })

  async function createFixture(): Promise<{
    originalFile: string
    targetRoot: string
    templateRoot: string
  }> {
    cwd = await mkdtemp(path.join(tmpdir(), 'eljs-project-creator-'))
    const targetRoot = path.join(cwd, 'project')
    const templateRoot = path.join(cwd, 'template')
    const originalFile = path.join(targetRoot, 'original.txt')

    await Promise.all([
      mkdir(targetRoot, { recursive: true }),
      mkdir(templateRoot, { recursive: true }),
    ])
    await writeFile(originalFile, 'original\n')

    return { originalFile, targetRoot, templateRoot }
  }
})
