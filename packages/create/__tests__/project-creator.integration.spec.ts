import * as fileUtils from '@eljs/utils/file'
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProjectCreator } from '../src/core'
import { acquireTargetLock, releaseTargetLock } from '../src/core/target-lock'

describe('ProjectCreator 目标恢复集成', () => {
  const abortControllerKey = '__eljsProjectCreatorAbortController'
  let cwd = ''

  afterEach(async () => {
    vi.restoreAllMocks()
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

  it('应该为不存在的多层嵌套目标创建父目录并正常提交', async () => {
    const fixture = await createFixture()
    await writeFile(
      path.join(fixture.templateRoot, 'create.config.js'),
      'module.exports = { defaultQuestions: false, gitInit: false, install: false }\n',
    )
    await new ProjectCreator({
      cwd,
      template: fixture.templateRoot,
    }).run('one/two/project')
    expect(
      await fileUtils.isDirectory(path.join(cwd, 'one', 'two', 'project')),
    ).toBe(true)
    expect(
      (await readdir(path.join(cwd, 'one', 'two'))).filter(name =>
        name.endsWith('.lock'),
      ),
    ).toEqual([])
  })

  it('提交删除备份中断后记录 committing 方向且同进程可重试清理', async () => {
    const fixture = await createFixture()
    await writeFile(
      path.join(fixture.templateRoot, 'create.config.js'),
      'module.exports = { defaultQuestions: false, gitInit: false, install: false }\n',
    )
    await writeFile(
      path.join(fixture.targetRoot, 'remaining.txt'),
      'remaining\n',
    )
    const realRemove = fileUtils.remove
    let interrupted = false
    vi.spyOn(fileUtils, 'remove').mockImplementation(
      async (candidate, options) => {
        if (
          !interrupted &&
          path.basename(candidate).startsWith('.eljs-backup-')
        ) {
          interrupted = true
          const metadata = await readRecoveryMetadata()
          expect(metadata.phase).toBe('committing')
          await rm(path.join(candidate, 'original.txt'))
          throw new Error('fixture backup deletion interrupted')
        }
        return realRemove(candidate, options)
      },
    )

    await expect(
      new ProjectCreator({
        cwd,
        template: fixture.templateRoot,
        force: true,
      }).run('project'),
    ).rejects.toMatchObject({ code: 'CREATE_CLEANUP_FAILED' })
    const metadata = await readRecoveryMetadata()
    expect(metadata).toMatchObject({
      phase: 'recovery-pending',
      recoveryPhase: 'committing',
      pid: process.pid,
    })
    await expect(
      fileUtils.pathExists(path.join(metadata.backupPath, 'remaining.txt')),
    ).resolves.toBe(true)

    const recovered = await acquireTargetLock(cwd, fixture.targetRoot)
    await expect(fileUtils.pathExists(fixture.originalFile)).resolves.toBe(
      false,
    )
    await expect(
      fileUtils.pathExists(path.join(fixture.targetRoot, 'remaining.txt')),
    ).resolves.toBe(false)
    await expect(fileUtils.pathExists(metadata.backupPath)).resolves.toBe(false)
    await expect(fileUtils.isDirectory(fixture.targetRoot)).resolves.toBe(true)
    await releaseTargetLock(recovered)
  })

  it('回滚移动失败后保留原备份与 pending，下一次同进程运行可恢复', async () => {
    const fixture = await createFixture()
    await writeFile(
      path.join(fixture.templateRoot, 'create.config.js'),
      'module.exports = { defaultQuestions: false, gitInit: false, install: false, plugins: ["./fail.cjs"] }\n',
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
    const realMove = fileUtils.move
    let failed = false
    vi.spyOn(fileUtils, 'move').mockImplementation(
      async (from, to, overwrite) => {
        if (!failed && path.basename(from).startsWith('.eljs-backup-')) {
          failed = true
          throw new Error('fixture rollback failed')
        }
        return realMove(from, to, overwrite)
      },
    )
    const creator = new ProjectCreator({
      cwd,
      template: fixture.templateRoot,
      force: true,
    })
    await expect(creator.run('project')).rejects.toMatchObject({
      code: 'CREATE_RECOVERY_FAILED',
    })
    const metadata = await readRecoveryMetadata()
    expect(metadata).toMatchObject({
      phase: 'recovery-pending',
      recoveryPhase: 'active',
      pid: process.pid,
    })
    await expect(
      readFile(path.join(metadata.backupPath, 'original.txt'), 'utf8'),
    ).resolves.toBe('original\n')
    await expect(fileUtils.pathExists(fixture.targetRoot)).resolves.toBe(false)
    expect(
      (await readdir(cwd)).some(name => name.startsWith('.eljs-move-')),
    ).toBe(false)

    // 后继恢复再次失败时仍保留可回收记录，不能绑定到这次恢复者的活跃 PID
    failed = false
    await expect(
      acquireTargetLock(cwd, fixture.targetRoot),
    ).rejects.toMatchObject({ code: 'CREATE_RECOVERY_FAILED' })
    expect(await readRecoveryMetadata()).toMatchObject({
      phase: 'recovery-pending',
      recoveryPhase: 'active',
      backupPath: metadata.backupPath,
    })

    // 第二次在模板预检处停下，直接观察获取锁时已完成的恢复结果
    await rm(path.join(fixture.templateRoot, 'create.config.js'))
    await expect(creator.run('project')).rejects.toMatchObject({
      code: 'CREATE_INVALID_TEMPLATE',
    })
    await expect(readFile(fixture.originalFile, 'utf8')).resolves.toBe(
      'original\n',
    )
    await expect(
      fileUtils.pathExists(path.join(fixture.targetRoot, 'partial.txt')),
    ).resolves.toBe(false)
    await expect(fileUtils.pathExists(metadata.backupPath)).resolves.toBe(false)
  })

  it('新目标回滚删除失败时无备份的 pending 也可重试', async () => {
    const fixture = await createFixture()
    await rm(fixture.targetRoot, { recursive: true })
    await writeFile(
      path.join(fixture.templateRoot, 'create.config.js'),
      'module.exports = { defaultQuestions: false, gitInit: false, install: false, plugins: ["./fail.cjs"] }\n',
    )
    await writeFile(
      path.join(fixture.templateRoot, 'fail.cjs'),
      `module.exports = context => {
  context.onGenerateFiles(() => { throw new Error('fixture generation failed') })
}
`,
    )
    const realRemove = fileUtils.remove
    vi.spyOn(fileUtils, 'remove').mockImplementation(
      async (candidate, options) => {
        if (
          candidate === fixture.targetRoot ||
          path.basename(candidate) === 'project'
        ) {
          throw new Error('fixture target deletion failed')
        }
        return realRemove(candidate, options)
      },
    )
    await expect(
      new ProjectCreator({
        cwd,
        template: fixture.templateRoot,
      }).run('project'),
    ).rejects.toMatchObject({ code: 'CREATE_RECOVERY_FAILED' })
    expect(await readRecoveryMetadata()).toMatchObject({
      phase: 'recovery-pending',
      recoveryPhase: 'active',
      targetExisted: false,
    })
    vi.restoreAllMocks()
    const recovered = await acquireTargetLock(cwd, fixture.targetRoot)
    await expect(fileUtils.pathExists(fixture.targetRoot)).resolves.toBe(false)
    await releaseTargetLock(recovered)
  })

  it('提交成功但删锁失败时也保留可重试记录', async () => {
    const fixture = await createFixture()
    await writeFile(
      path.join(fixture.templateRoot, 'create.config.js'),
      'module.exports = { defaultQuestions: false, gitInit: false, install: false }\n',
    )
    const realRemove = fileUtils.remove
    let failed = false
    vi.spyOn(fileUtils, 'remove').mockImplementation(
      async (candidate, options) => {
        if (!failed && candidate.endsWith('.lock')) {
          failed = true
          throw new Error('fixture lock deletion failed')
        }
        return realRemove(candidate, options)
      },
    )
    await expect(
      new ProjectCreator({
        cwd,
        template: fixture.templateRoot,
        force: true,
      }).run('project'),
    ).rejects.toMatchObject({ code: 'CREATE_CLEANUP_FAILED' })
    expect(await readRecoveryMetadata()).toMatchObject({
      phase: 'recovery-pending',
      recoveryPhase: 'committing',
    })
    const recovered = await acquireTargetLock(cwd, fixture.targetRoot)
    await expect(fileUtils.isDirectory(fixture.targetRoot)).resolves.toBe(true)
    await expect(fileUtils.pathExists(fixture.originalFile)).resolves.toBe(
      false,
    )
    await releaseTargetLock(recovered)
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

  it('应该在本地模版目录内生成目标项目', async () => {
    const fixture = await createFixture()
    await writeFile(
      path.join(fixture.templateRoot, 'create.config.js'),
      `module.exports = {
  defaultQuestions: false,
  gitInit: false,
  install: false,
  plugins: ['./write.cjs'],
}
`,
    )
    await writeFile(
      path.join(fixture.templateRoot, 'write.cjs'),
      `const fs = require('node:fs')
const path = require('node:path')

module.exports = context => {
  context.onGenerateFiles(() => {
    fs.writeFileSync(path.join(context.paths.target, 'generated.txt'), 'generated\\n')
  })
}
`,
    )

    await expect(
      new ProjectCreator({
        cwd: fixture.templateRoot,
        template: '.',
        force: true,
      }).run('nested'),
    ).resolves.toBeUndefined()

    // 模板资产在生成后仍然存在
    await expect(
      readFile(path.join(fixture.templateRoot, 'create.config.js'), 'utf8'),
    ).resolves.toContain('defaultQuestions')
    await expect(
      readFile(path.join(fixture.templateRoot, 'write.cjs'), 'utf8'),
    ).resolves.toContain('onGenerateFiles')
    await expect(
      readFile(
        path.join(fixture.templateRoot, 'nested', 'generated.txt'),
        'utf8',
      ),
    ).resolves.toBe('generated\n')
  })

  it('应该拒绝通过符号链接吞掉本地模版根的目标目录', async () => {
    const fixture = await createFixture()
    // cwd 内的符号链接指向 cwd 本身，使 canonical 目标成为模板根的祖先
    const selfLink = path.join(cwd, 'to-cwd')
    await symlink(cwd, selfLink)

    await expect(
      new ProjectCreator({
        cwd,
        template: '.',
        force: true,
      }).run('to-cwd'),
    ).rejects.toMatchObject({ code: 'CREATE_INVALID_PROJECT_NAME' })

    // 拒绝后模板资产未被移动或清理
    await expect(readFile(fixture.originalFile, 'utf8')).resolves.toBe(
      'original\n',
    )
    await expect(
      readFile(path.join(fixture.templateRoot, 'original.txt'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('远程模板也不能通过目标别名覆盖原工作目录根', async () => {
    const fixture = await createFixture()
    await symlink(
      cwd,
      path.join(cwd, 'self'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    await expect(
      new ProjectCreator({
        cwd,
        template: { type: 'npm', value: 'must-not-download', trusted: true },
        force: true,
      }).run('self'),
    ).rejects.toMatchObject({ code: 'CREATE_INVALID_PROJECT_NAME' })
    await expect(readFile(fixture.originalFile, 'utf8')).resolves.toBe(
      'original\n',
    )
    expect((await readdir(cwd)).some(name => name.startsWith('.eljs-'))).toBe(
      false,
    )
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

  async function readRecoveryMetadata(): Promise<{
    phase: string
    recoveryPhase?: string
    backupPath: string
    pid: number
    targetExisted: boolean
  }> {
    const locks = (await readdir(cwd)).filter(name => name.endsWith('.lock'))
    expect(locks).toHaveLength(1)
    return JSON.parse(await readFile(path.join(cwd, locks[0]), 'utf8'))
  }
})
