import { existsSync } from 'node:fs'
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
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  copyDirectory,
  copyDirectorySync,
  copyFile,
  copyFileSync,
  copyTemplate,
  copyTemplateSync,
} from '../../src/file/copy'
import {
  resolveWriteDestination,
  resolveWriteDestinationSync,
} from '../../src/file/write-boundary'

describe.each([false, true])('写入边界（同步：%s）', synchronous => {
  let fixture = ''
  let root = ''
  let outside = ''
  let source = ''

  beforeEach(async () => {
    fixture = await mkdtemp(path.join(tmpdir(), 'eljs-write-boundary-'))
    root = path.join(fixture, 'output')
    outside = path.join(fixture, 'outside')
    source = path.join(fixture, 'source.txt')
    await mkdir(root)
    await mkdir(outside)
    await writeFile(source, 'replacement')
    await writeFile(path.join(outside, 'existing.txt'), 'original')
  })

  afterEach(async () => {
    await rm(fixture, { recursive: true, force: true })
  })

  async function copy(destination: string): Promise<void> {
    const options = { destinationRoot: root }
    if (synchronous) {
      copyFileSync(source, destination, options)
    } else {
      await copyFile(source, destination, options)
    }
  }

  it('允许新建嵌套目录中的普通文件', async () => {
    const destination = path.join(root, 'src', 'index.txt')
    await copy(destination)
    expect(await readFile(destination, 'utf8')).toBe('replacement')
  })

  it('拒绝指向外部目录的链接并保留外部文件', async () => {
    await symlink(
      outside,
      path.join(root, 'linked'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    await expect(
      copy(path.join(root, 'linked', 'existing.txt')),
    ).rejects.toThrow('symbolic link')
    expect(await readFile(path.join(outside, 'existing.txt'), 'utf8')).toBe(
      'original',
    )
  })

  it('拒绝悬空文件链接，避免在外部创建文件', async () => {
    const externalFile = path.join(outside, 'new.txt')
    await symlink(externalFile, path.join(root, 'new.txt'), 'file')
    await expect(copy(path.join(root, 'new.txt'))).rejects.toThrow(
      'symbolic link',
    )
    expect(existsSync(externalFile)).toBe(false)
  })

  it('拒绝渲染后越界的模板文件名', async () => {
    const destination = path.join(root, '{{{name}}}.tpl')
    const data = { name: '../outside/new' }
    const operation = async () => {
      if (synchronous) {
        copyTemplateSync(source, destination, data, { destinationRoot: root })
      } else {
        await copyTemplate(source, destination, data, { destinationRoot: root })
      }
    }
    await expect(operation()).rejects.toThrow('escapes root')
    expect(existsSync(path.join(outside, 'new'))).toBe(false)
  })

  it('目录复制同样保护普通文件写入', async () => {
    const template = path.join(fixture, 'template')
    await mkdir(path.join(template, 'linked'), { recursive: true })
    await writeFile(
      path.join(template, 'linked', 'existing.txt'),
      'replacement',
    )
    await symlink(
      outside,
      path.join(root, 'linked'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    const operation = async () => {
      if (synchronous) {
        copyDirectorySync(template, root, {}, { destinationRoot: root })
      } else {
        await copyDirectory(template, root, {}, { destinationRoot: root })
      }
    }
    await expect(operation()).rejects.toThrow('symbolic link')
    expect(await readFile(path.join(outside, 'existing.txt'), 'utf8')).toBe(
      'original',
    )
  })

  it('输出根目录可以使用符号链接别名', async () => {
    const alias = path.join(fixture, 'alias')
    await symlink(
      root,
      alias,
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    const destination = path.join(alias, 'file.txt')
    const canonical = synchronous
      ? resolveWriteDestinationSync(destination, alias)
      : await resolveWriteDestination(destination, alias)
    await writeFile(canonical, 'safe')
    expect(await readFile(path.join(root, 'file.txt'), 'utf8')).toBe('safe')
    const canonicalInput = synchronous
      ? resolveWriteDestinationSync(canonical, alias)
      : await resolveWriteDestination(canonical, alias)
    expect(canonicalInput).toBe(canonical)
  })

  it('直接文件路径越界时不创建任何目录', async () => {
    const destination = path.join(outside, 'new-directory', 'file.txt')
    await expect(copy(destination)).rejects.toThrow('escapes root')
    expect(existsSync(path.dirname(destination))).toBe(false)
  })
})
