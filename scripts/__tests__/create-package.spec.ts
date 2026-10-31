import { spawnSync } from 'node:child_process'
import {
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
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createPackages } from '../create-package'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
let fixtureRoot: string

beforeEach(async () => {
  fixtureRoot = await mkdtemp(path.join(tmpdir(), 'eljs-package-create-'))
  await mkdir(path.join(fixtureRoot, 'packages'))
  await writeFile(
    path.join(fixtureRoot, 'package.json'),
    JSON.stringify({ version: '2.0.0' }),
  )
})

afterEach(async () => {
  await rm(fixtureRoot, { recursive: true, force: true })
})

describe('包脚手架交付契约', () => {
  it('生成可发布的双语包并保留已有文档', async () => {
    await createPackages(fixtureRoot, [
      'packages/example-tool',
      '--description',
      'An example tool.',
    ])
    const pkgRoot = path.join(fixtureRoot, 'packages/example-tool')
    const manifest = JSON.parse(
      await readFile(path.join(pkgRoot, 'package.json'), 'utf8'),
    )
    expect(manifest).toMatchObject({
      name: '@eljs/example-tool',
      version: '2.0.0',
      files: ['dist', 'README.md', 'README.zh-CN.md'],
    })
    const english = await readFile(path.join(pkgRoot, 'README.md'), 'utf8')
    const chinese = await readFile(
      path.join(pkgRoot, 'README.zh-CN.md'),
      'utf8',
    )
    const codeBlocks = (text: string) => text.match(/```[\s\S]*?```/g)
    expect(codeBlocks(chinese)).toEqual(codeBlocks(english))
    expect(english).toContain('[简体中文](README.zh-CN.md)')
    expect(chinese).toContain('[English](README.md)')
    expect(chinese).toContain('## 安装')
    expect(english).toContain('import * as exampleToolApi')

    await writeFile(
      path.join(pkgRoot, 'README.md'),
      `${english}\nCustom text\n`,
    )
    await createPackages(fixtureRoot, ['packages/example-tool'])
    expect(await readFile(path.join(pkgRoot, 'README.md'), 'utf8')).toBe(
      `${english}\nCustom text\n`,
    )
  })

  it.each(['../outside', 'packages/nested/tool', 'packages/123-tool'])(
    '拒绝非法路径 %s 且不写入包目录',
    async directory => {
      await expect(
        createPackages(fixtureRoot, [directory, '--description', 'Example']),
      ).rejects.toThrow('Package path must be')
      expect(await readdir(path.join(fixtureRoot, 'packages'))).toEqual([])
    },
  )

  it.each([false, true])('显式描述优先于已有描述，force=%s', async force => {
    const pkgRoot = path.join(fixtureRoot, 'packages/example')
    await mkdir(pkgRoot)
    await writeFile(
      path.join(pkgRoot, 'package.json'),
      JSON.stringify({
        name: '@eljs/example',
        version: '2.0.0',
        description: 'Old description',
        dependencies: { example: '^1.0.0' },
      }),
    )
    await createPackages(fixtureRoot, [
      'packages/example',
      '--description',
      'New description',
      ...(force ? ['--force'] : []),
    ])
    const manifest = JSON.parse(
      await readFile(path.join(pkgRoot, 'package.json'), 'utf8'),
    )
    expect(manifest.description).toBe('New description')
    expect(manifest.dependencies).toEqual({ example: '^1.0.0' })
  })

  it('拒绝符号链接目录', async () => {
    await mkdir(path.join(fixtureRoot, 'outside'))
    await symlink(
      path.join(fixtureRoot, 'outside'),
      path.join(fixtureRoot, 'packages/linked'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    await expect(
      createPackages(fixtureRoot, [
        'packages/linked',
        '--description',
        'Example',
      ]),
    ).rejects.toThrow('symbolic link')
    expect(await readdir(path.join(fixtureRoot, 'outside'))).toEqual([])
  })

  it('既有单语文档不能被模板冒充翻译，检查失败前不生成清单', async () => {
    const pkgRoot = path.join(fixtureRoot, 'packages/example')
    await mkdir(pkgRoot)
    await writeFile(path.join(pkgRoot, 'README.md'), '# Existing API\n')
    await expect(
      createPackages(fixtureRoot, [
        'packages/example',
        '--description',
        'Example',
      ]),
    ).rejects.toThrow('synchronized bilingual READMEs')
    expect(await readdir(pkgRoot)).toEqual(['README.md'])
  })

  it('真实 ESM CLI 能完成路径校验而非因 __dirname 失败', () => {
    const result = spawnSync(
      process.execPath,
      [
        path.join(repoRoot, 'node_modules/tsx/dist/cli.mjs'),
        path.join(repoRoot, 'scripts/create-package.ts'),
        '../invalid-package-boundary',
        '--description',
        'Boundary probe',
      ],
      { encoding: 'utf8', cwd: fixtureRoot },
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Package path must be')
    expect(result.stderr).not.toContain('__dirname')
  })
})
