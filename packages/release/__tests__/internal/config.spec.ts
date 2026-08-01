import { describe, expect, it } from 'vitest'

import { validateResolvedConfig } from '../../src/internal/config'
import type { ResolvedConfig } from '../../src/types'

function createConfig(): ResolvedConfig {
  return {
    cwd: '/project',
    dryRun: false,
    git: {
      requireClean: true,
      changelog: {
        filename: 'CHANGELOG.md',
        placeholder: 'No changes',
      },
      independent: false,
      commit: true,
      commitMessage: 'chore: release ${version}',
      push: true,
      pushArgs: ['--follow-tags'],
    },
    npm: {
      requireOwner: true,
      networkConcurrency: 8,
      canary: false,
      confirm: true,
    },
    github: {
      release: true,
      mode: 'browser',
      tokenEnv: 'GITHUB_TOKEN',
    },
  }
}

describe('release 配置运行时校验', () => {
  it('应该返回合法的解析后配置', () => {
    const config = createConfig()

    expect(validateResolvedConfig(config)).toBe(config)
  })

  it('应该允许关闭 changelog 和使用自定义预发布标识', () => {
    const config = createConfig()
    config.git.changelog = false
    config.npm.prereleaseId = 'preview'

    expect(validateResolvedConfig(config)).toBe(config)
  })

  it.each(['latest', '123', 'preview.1', 'preview tag'])(
    '应该拒绝不能安全用作 dist-tag 的预发布标识 %s',
    prereleaseId => {
      const config = createConfig()
      config.npm.prereleaseId = prereleaseId

      expect(() => validateResolvedConfig(config)).toThrow(
        'Invalid release config `npm.prereleaseId`',
      )
    },
  )

  it('应该拒绝 canary 模式与其他预发布标识组合', () => {
    const config = createConfig()
    config.npm.canary = true
    config.npm.prereleaseId = 'preview'

    expect(() => validateResolvedConfig(config)).toThrow(
      'Invalid release config `npm.prereleaseId`',
    )
  })

  it('应该拒绝关闭预发布模式后仍配置预发布标识', () => {
    const config = createConfig()
    config.npm.prerelease = false
    config.npm.prereleaseId = 'preview'

    expect(() => validateResolvedConfig(config)).toThrow(
      'Invalid release config `npm.prerelease`',
    )
  })

  it.each([
    ['cwd', config => (config.cwd = '')],
    [
      'git.requireClean',
      config =>
        ((config.git as unknown as Record<string, unknown>).requireClean =
          'true'),
    ],
    [
      'git.pushArgs',
      config =>
        ((config.git as unknown as Record<string, unknown>).pushArgs = [
          '--follow-tags',
          1,
        ]),
    ],
    [
      'npm.prereleaseId',
      config =>
        ((config.npm as unknown as Record<string, unknown>).prereleaseId = ''),
    ],
    [
      'npm.registry',
      config =>
        ((config.npm as unknown as Record<string, unknown>).registry = ''),
    ],
    [
      'npm.networkConcurrency',
      config =>
        ((config.npm as unknown as Record<string, unknown>).networkConcurrency =
          0),
    ],
    [
      'github.release',
      config =>
        ((config.github as unknown as Record<string, unknown>).release = 'yes'),
    ],
    [
      'github.mode',
      config =>
        ((config.github as unknown as Record<string, unknown>).mode = 'cli'),
    ],
    [
      'github.tokenEnv',
      config =>
        ((config.github as unknown as Record<string, unknown>).tokenEnv = ''),
    ],
    [
      'github.tokenEnv',
      config =>
        ((config.github as unknown as Record<string, unknown>).tokenEnv =
          'INVALID-NAME'),
    ],
  ] satisfies Array<[string, (config: ResolvedConfig) => void]>)(
    '应该拒绝无效字段 %s',
    (path, mutate) => {
      const config = createConfig()
      mutate(config)

      expect(() => validateResolvedConfig(config)).toThrow(
        `Invalid release config \`${path}\``,
      )
    },
  )
})
