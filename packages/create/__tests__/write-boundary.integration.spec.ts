import {
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

describe('merge 写入边界', () => {
  let fixture = ''
  afterEach(async () => {
    await rm(fixture, { recursive: true, force: true })
  })

  it.each(['src', 'package.json'])(
    '保留原目标中的 %s 链接但不写入外部',
    async name => {
      fixture = await mkdtemp(
        path.join(tmpdir(), 'eljs-create-merge-boundary-'),
      )
      const workspace = path.join(fixture, 'workspace')
      const template = path.join(fixture, 'template')
      const target = path.join(workspace, 'app')
      const outside = path.join(fixture, 'outside')
      await mkdir(target, { recursive: true })
      await mkdir(path.join(template, 'files', 'src'), { recursive: true })
      await mkdir(path.join(template, 'generators'))
      await mkdir(outside)
      const externalFile = path.join(outside, 'package.json')
      await writeFile(externalFile, '{"name":"external"}')
      await writeFile(path.join(outside, 'index.txt'), 'original')
      await writeFile(
        path.join(template, 'create.config.js'),
        'module.exports = { defaultQuestions: false, gitInit: false, install: false }',
      )
      await writeFile(
        path.join(template, 'generators', 'index.js'),
        `module.exports = context => {
        context.extendPackage({ name: 'generated' })
        context.onStart(async () => {
          await context.copyDirectory(
            require('node:path').join(context.paths.cwd, 'files'),
            context.paths.target,
          )
        })
      }`,
      )
      await writeFile(path.join(template, 'files', 'src', 'index.txt'), 'new')
      await symlink(
        name === 'src' ? outside : externalFile,
        path.join(target, name),
        name === 'src'
          ? process.platform === 'win32'
            ? 'junction'
            : 'dir'
          : 'file',
      )
      await expect(
        new ProjectCreator({ cwd: workspace, template, merge: true }).run(
          'app',
        ),
      ).rejects.toThrow('symbolic link')
      expect(await readFile(externalFile, 'utf8')).toBe('{"name":"external"}')
      expect(await readFile(path.join(outside, 'index.txt'), 'utf8')).toBe(
        'original',
      )
    },
  )
})
