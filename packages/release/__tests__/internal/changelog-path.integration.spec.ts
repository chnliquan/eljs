import { execFile } from 'node:child_process'
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { defaultConfig } from '../../src/default'
import { resolveChangelogPath } from '../../src/internal/changelog-path'
import gitPlugin from '../../src/internal/plugins/git'
import type { ReleasePluginContext, ResolvedConfig } from '../../src/types'

const execute = promisify(execFile)
const info = {
  version: '1.1.0',
  isPrerelease: false,
  prereleaseId: null,
  changelog: '## 1.1.0\n\n- fixture',
}

describe('更新日志写入边界与真实 Git 元数据', () => {
  let temporaryRoot = ''
  afterEach(async () => {
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true })
  })

  it.each([
    '../outside.md',
    '.git/HEAD',
    'notes/../.git/config',
    '.git/../CHANGELOG.md',
    '/tmp/release-changelog.md',
  ])('配置 %s 不得产生读取或覆盖副作用', async filename => {
    const cwd = await fixture()
    const head = await readFile(path.join(cwd, '.git/HEAD'))
    const outside = path.join(temporaryRoot, 'outside.md')
    await writeFile(outside, 'untouched')
    const context = pluginContext(cwd, filename)
    await expect(
      context.onBeforeRelease.mock.calls[0][0](info),
    ).rejects.toThrow()
    expect(await readFile(outside, 'utf8')).toBe('untouched')
    expect(await readFile(path.join(cwd, '.git/HEAD'))).toEqual(head)
  })

  it.each(['file', 'parent', 'dangling', 'internal'])(
    '拒绝 %s 符号链接路径，包括指向工作区内的链接',
    async kind => {
      const cwd = await fixture()
      const outside = path.join(temporaryRoot, 'outside.md')
      await writeFile(outside, 'untouched')
      let filename = 'CHANGELOG.md'
      if (kind === 'parent') {
        await symlink(temporaryRoot, path.join(cwd, 'notes'))
        filename = 'notes/outside.md'
      } else if (kind === 'internal') {
        await mkdir(path.join(cwd, 'notes'))
        await symlink(path.join(cwd, 'notes'), path.join(cwd, 'linked'))
        filename = 'linked/CHANGELOG.md'
      } else {
        await symlink(
          kind === 'file' ? outside : path.join(temporaryRoot, 'missing.md'),
          path.join(cwd, filename),
        )
      }
      const context = pluginContext(cwd, filename)
      await expect(
        context.onBeforeRelease.mock.calls[0][0](info),
      ).rejects.toThrow('symbolic link')
      expect(await readFile(outside, 'utf8')).toBe('untouched')
    },
  )

  it('独立 gitdir 即使位于工作目录内且不叫 .git 也不可覆盖', async () => {
    const cwd = await fixture(true)
    const head = await readFile(path.join(cwd, 'metadata/HEAD'))
    const context = pluginContext(cwd, 'metadata/HEAD')
    await expect(
      context.onBeforeRelease.mock.calls[0][0](info),
    ).rejects.toThrow('Git metadata')
    expect(await readFile(path.join(cwd, 'metadata/HEAD'))).toEqual(head)
    await expect(
      resolveChangelogPath(cwd, 'metadata/new-file'),
    ).rejects.toThrow('Git metadata')
  })

  it('gitdir 的符号链接别名也不能用作日志路径', async () => {
    const cwd = await fixture(true)
    await symlink(path.join(cwd, 'metadata'), path.join(cwd, 'alias'))
    await expect(resolveChangelogPath(cwd, 'alias/HEAD')).rejects.toThrow(
      'symbolic link',
    )
  })

  it('gitdir 本身是符号链接时仍排除其真实位置', async () => {
    const cwd = await fixture(true)
    const actual = path.join(cwd, 'actual-metadata')
    await rename(path.join(cwd, 'metadata'), actual)
    await symlink(actual, path.join(cwd, 'metadata'))
    await expect(
      resolveChangelogPath(cwd, 'actual-metadata/HEAD'),
    ).rejects.toThrow('Git metadata')
  })

  it('共享 gitdir 和工作区根目录别名均按实际位置处理', async () => {
    const cwd = await fixture()
    // 无需提交即可构造 Git 支持的 commondir 布局，验证查询返回的公共目录边界
    const localGitDir = path.join(cwd, 'local-metadata')
    await mkdir(localGitDir)
    await writeFile(path.join(localGitDir, 'HEAD'), 'ref: refs/heads/main\n')
    await writeFile(path.join(localGitDir, 'commondir'), '../.git\n')
    const alias = path.join(temporaryRoot, 'root-alias')
    await symlink(cwd, alias)
    expect(await resolveChangelogPath(alias, 'notes/CHANGELOG.md')).toBe(
      path.join(await realpath(cwd), 'notes/CHANGELOG.md'),
    )
    // 单独 gitdir 入口保留公共目录的 HEAD/objects/refs，Git 查询会识别两者
    const common = path.join(cwd, 'common-metadata')
    await execute('git', ['init', '--bare', common])
    await writeFile(path.join(localGitDir, 'commondir'), '../common-metadata\n')
    await rm(path.join(cwd, '.git'), { recursive: true })
    await writeFile(path.join(cwd, '.git'), 'gitdir: local-metadata\n')
    await expect(
      resolveChangelogPath(cwd, 'common-metadata/HEAD'),
    ).rejects.toThrow('Git metadata')
    await expect(
      resolveChangelogPath(cwd, 'local-metadata/HEAD'),
    ).rejects.toThrow('Git metadata')
  })

  it('自定义正常子路径可原子创建与追加日志', async () => {
    const cwd = await fixture()
    const context = pluginContext(cwd, 'notes/releases/CHANGELOG.md')
    await context.onBeforeRelease.mock.calls[0][0](info)
    const destination = path.join(cwd, 'notes/releases/CHANGELOG.md')
    expect(await readFile(destination, 'utf8')).toContain('## 1.1.0')
    await context.onBeforeRelease.mock.calls[0][0]({
      ...info,
      changelog: '## 1.2.0\n\n- next',
    })
    const content = await readFile(destination, 'utf8')
    expect(content.indexOf('## 1.2.0')).toBeLessThan(
      content.indexOf('## 1.1.0'),
    )
  })

  async function fixture(separate = false) {
    temporaryRoot = await mkdtemp(
      path.join(tmpdir(), 'eljs-changelog-boundary-'),
    )
    const cwd = path.join(temporaryRoot, 'repo')
    await mkdir(cwd)
    await execute(
      'git',
      separate
        ? ['init', '--separate-git-dir', path.join(cwd, 'metadata'), cwd]
        : ['init', cwd],
    )
    return cwd
  }
})

function pluginContext(cwd: string, filename: string) {
  const config = structuredClone(defaultConfig) as ResolvedConfig
  config.git.changelog = {
    ...(config.git.changelog || {}),
    filename,
    placeholder: 'No changes',
  }
  const context = {
    cwd,
    config,
    appData: { workspacePackages: [] },
    step: vi.fn(),
    onCheck: vi.fn(),
    getChangelog: vi.fn(),
    onBeforeRelease:
      vi.fn<(handler: (args: typeof info) => Promise<void>) => void>(),
    onRelease: vi.fn(),
    onError: vi.fn(),
    onAfterRelease: vi.fn(),
  }
  gitPlugin(context as unknown as ReleasePluginContext)
  return context
}
