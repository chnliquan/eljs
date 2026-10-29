import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getCallerDirectory,
  getWorkspacePackageRoots,
  getWorkspaceRoot,
} from '../../src/path'

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'utils-workspace-'))
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

async function fixture(file: string, content = '{}'): Promise<void> {
  const target = path.join(directory, file)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, content)
}

describe('工作区真实文件系统契约', () => {
  it.each(['npm', 'pnpm'])(
    '保留 %s 递归、点号目录、排除与去重语义',
    async manager => {
      const patterns = ['packages/**', 'packages/plain', '!packages/excluded']
      await fixture(
        'package.json',
        JSON.stringify({
          packageManager: `${manager}@10.0.0`,
          workspaces: patterns,
        }),
      )
      if (manager === 'pnpm') {
        await fixture(
          'pnpm-workspace.yaml',
          `packages:\n${patterns.map(value => `  - '${value}'`).join('\n')}\n`,
        )
      } else {
        await fixture('package-lock.json')
      }
      await Promise.all([
        fixture('packages/plain/package.json'),
        fixture('packages/with.dot/package.json'),
        fixture('packages/group/nested/package.json'),
        fixture('packages/excluded/package.json'),
        fixture('packages/excluded/nested/package.json'),
        fixture('packages/plain/node_modules/dependency/package.json'),
        fixture('packages/README', 'not a package'),
      ])

      const relative = await getWorkspacePackageRoots(directory, true)
      expect(relative.sort()).toEqual(
        [
          path.join('packages', 'group', 'nested'),
          path.join('packages', 'plain'),
          path.join('packages', 'with.dot'),
        ].sort(),
      )
      expect((await getWorkspacePackageRoots(directory)).sort()).toEqual(
        relative.map(value => path.join(directory, value)).sort(),
      )
    },
  )

  it('内层 npm 项目比外层 pnpm 工作区更近', async () => {
    await fixture('pnpm-workspace.yaml', 'packages: []')
    await fixture('inner/package-lock.json')
    await fixture('inner/package.json', '{"workspaces":["packages/*"]}')
    await fixture('inner/packages/nested/package.json')
    await mkdir(path.join(directory, 'inner', 'src'))
    expect(await getWorkspaceRoot(path.join(directory, 'inner', 'src'))).toBe(
      path.join(directory, 'inner'),
    )
    expect(
      await getWorkspacePackageRoots(path.join(directory, 'inner'), true),
    ).toEqual([path.join('packages', 'nested')])
  })

  it('保留未配置工作区时的单包返回值', async () => {
    await fixture('package.json', '{"packageManager":"npm@10.0.0"}')
    expect(await getWorkspacePackageRoots(directory, true)).toEqual(['.'])
    expect(await getWorkspacePackageRoots(directory)).toEqual([directory])
  })
})

describe('调用方路径', () => {
  it('从实际调用栈返回文件系统目录', () => {
    expect(getCallerDirectory()).toBe(
      path.dirname(fileURLToPath(import.meta.url)),
    )
  })

  it('解码带空格和非 ASCII 字符的 ESM URL', () => {
    const file = path.join(directory, '含 空格', 'caller.mjs')
    const capture = vi
      .spyOn(Error, 'captureStackTrace')
      .mockImplementation(target => {
        Object.assign(target, {
          stack: `Error\n at helper (/helper.js:1:1)\n at call (${pathToFileURL(file).href}:3:4)`,
        })
      })
    try {
      expect(getCallerDirectory()).toBe(path.dirname(file))
    } finally {
      capture.mockRestore()
    }
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    '拒绝无效栈深度 %s',
    depth => {
      expect(() => getCallerDirectory(depth)).toThrow(RangeError)
    },
  )
})
