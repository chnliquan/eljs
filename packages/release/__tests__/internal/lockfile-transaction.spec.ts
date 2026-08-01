import { afterEach, describe, expect, it } from 'vitest'

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  captureLockfiles,
  restoreLockfiles,
} from '../../src/internal/lockfile-transaction'

describe('锁文件事务快照', () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map(directory =>
        rm(directory, {
          force: true,
          recursive: true,
        }),
      ),
    )
  })

  it('应该恢复文本和二进制锁文件并删除事务中新建的锁文件', async () => {
    const cwd = await createTemporaryDirectory()
    const pnpmLockPath = path.join(cwd, 'pnpm-lock.yaml')
    const bunLockPath = path.join(cwd, 'bun.lockb')
    const npmLockPath = path.join(cwd, 'package-lock.json')
    await writeFile(pnpmLockPath, 'lockfileVersion: 9\n')
    await writeFile(bunLockPath, Buffer.from([0, 1, 2, 255]))
    const snapshot = await captureLockfiles(cwd)

    await writeFile(pnpmLockPath, 'changed\n')
    await writeFile(bunLockPath, Buffer.from([9, 9]))
    await writeFile(npmLockPath, '{}\n')
    await restoreLockfiles(snapshot)

    await expect(readFile(pnpmLockPath, 'utf8')).resolves.toBe(
      'lockfileVersion: 9\n',
    )
    await expect(readFile(bunLockPath)).resolves.toEqual(
      Buffer.from([0, 1, 2, 255]),
    )
    await expect(readFile(npmLockPath)).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it('空目录快照应该删除命令生成的 Bun 新锁文件', async () => {
    const cwd = await createTemporaryDirectory()
    const snapshot = await captureLockfiles(cwd)
    const bunLockPath = path.join(cwd, 'bun.lock')
    await writeFile(bunLockPath, '{}\n')

    await restoreLockfiles(snapshot)

    await expect(readFile(bunLockPath)).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  async function createTemporaryDirectory(): Promise<string> {
    const directory = await mkdtemp(path.join(tmpdir(), 'release-lockfile-'))
    temporaryDirectories.push(directory)
    return directory
  }
})
