import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { findUp } from '../../src/module'

describe('findUp 兼容适配', () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map(directory => rm(directory, { force: true, recursive: true })),
    )
  })

  async function createFixture(): Promise<{
    nestedDirectory: string
    packageFile: string
  }> {
    const rootDirectory = await mkdtemp(path.join(os.tmpdir(), 'eljs-find-up-'))
    temporaryDirectories.push(rootDirectory)
    const nestedDirectory = path.join(rootDirectory, 'packages', 'example')
    const packageFile = path.join(rootDirectory, 'package.json')

    await mkdir(nestedDirectory, { recursive: true })
    await writeFile(packageFile, '{}')

    return { nestedDirectory, packageFile }
  }

  it('应该异步向上查找文件', async () => {
    const { nestedDirectory, packageFile } = await createFixture()

    await expect(
      findUp('package.json', { cwd: nestedDirectory }),
    ).resolves.toBe(packageFile)
    await expect(findUp.exists(packageFile)).resolves.toBe(true)
  })

  it('应该保留同步查找和停止标记', async () => {
    const { nestedDirectory, packageFile } = await createFixture()

    expect(findUp.sync('package.json', { cwd: nestedDirectory })).toBe(
      packageFile,
    )
    expect(findUp.sync.exists(packageFile)).toBe(true)
    expect(typeof findUp.stop).toBe('symbol')
  })
})
