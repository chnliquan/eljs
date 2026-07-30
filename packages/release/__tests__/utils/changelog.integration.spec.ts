import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { getChangelog } from '../../src/utils/changelog'

describe('更新日志真实集成', () => {
  let repositoryPath: string | undefined

  afterEach(() => {
    if (repositoryPath) {
      rmSync(repositoryPath, { recursive: true, force: true })
      repositoryPath = undefined
    }
  })

  it('应该使用真实 preset 和 git 提交生成更新日志', async () => {
    repositoryPath = mkdtempSync(path.join(tmpdir(), 'eljs-changelog-'))
    writeFileSync(
      path.join(repositoryPath, 'package.json'),
      `${JSON.stringify(
        {
          name: 'integration-package',
          version: '1.0.0',
        },
        null,
        2,
      )}\n`,
    )
    writeFileSync(
      path.join(repositoryPath, 'index.js'),
      'export const value = true\n',
    )

    runGit(repositoryPath, ['init'])
    runGit(repositoryPath, ['config', 'user.name', 'Eljs Test'])
    runGit(repositoryPath, ['config', 'user.email', 'test@eljs.dev'])
    runGit(repositoryPath, ['add', '.'])
    runGit(repositoryPath, ['commit', '-m', 'feat(core): initial feature'])

    const changelog = await getChangelog({ cwd: repositoryPath })

    expect(changelog).toContain('✨ Features')
    expect(changelog).toContain('initial feature')
  })

  it('应该在独立模式下使用包名标签生成正确的提交范围', async () => {
    repositoryPath = mkdtempSync(path.join(tmpdir(), 'eljs-changelog-'))
    writePackageJson(repositoryPath, '1.0.0')
    writeFileSync(
      path.join(repositoryPath, 'index.js'),
      'export const value = 1\n',
    )

    runGit(repositoryPath, ['init'])
    runGit(repositoryPath, ['config', 'user.name', 'Eljs Test'])
    runGit(repositoryPath, ['config', 'user.email', 'test@eljs.dev'])
    runGit(repositoryPath, ['add', '.'])
    runGit(repositoryPath, ['commit', '-m', 'feat(core): initial feature'])
    runGit(repositoryPath, ['tag', 'integration-package@1.0.0'])

    writePackageJson(repositoryPath, '1.1.0')
    writeFileSync(
      path.join(repositoryPath, 'index.js'),
      'export const value = 2\n',
    )
    runGit(repositoryPath, ['add', '.'])
    runGit(repositoryPath, ['commit', '-m', 'fix(core): independent fix'])

    const changelog = await getChangelog({
      cwd: repositoryPath,
      independent: true,
    })

    expect(changelog).toContain('🐛 Bug Fixes')
    expect(changelog).toContain('independent fix')
    expect(changelog).not.toContain('initial feature')
    expect(changelog).toContain(
      'integration-package%401.0.0...integration-package%401.1.0',
    )
  })
})

function runGit(cwd: string, args: string[]): void {
  execFileSync('git', args, {
    cwd,
    stdio: 'pipe',
  })
}

function writePackageJson(cwd: string, version: string): void {
  writeFileSync(
    path.join(cwd, 'package.json'),
    `${JSON.stringify(
      {
        name: 'integration-package',
        version,
        repository: {
          type: 'git',
          url: 'https://github.com/chnliquan/integration-package.git',
        },
      },
      null,
      2,
    )}\n`,
  )
}
