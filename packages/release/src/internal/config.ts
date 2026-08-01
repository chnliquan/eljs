import semver from 'semver'
import type { ResolvedConfig } from '../types'
import { AppError } from '../utils'

/**
 * 校验完成默认值合并和 Hook 修改后的 release 配置
 *
 * @param input - 待校验配置
 * @returns 可供发布阶段使用的配置
 * @throws {@link AppError}
 * 当配置字段类型或约束无效时抛出
 * @internal
 */
export function validateResolvedConfig(input: unknown): ResolvedConfig {
  const config = requireRecord(input, 'config')
  requireString(config.cwd, 'cwd')
  requireBoolean(config.dryRun, 'dryRun')

  const git = requireRecord(config.git, 'git')
  requireBoolean(git.requireClean, 'git.requireClean')
  optionalString(git.requireBranch, 'git.requireBranch')
  requireBoolean(git.independent, 'git.independent')
  requireBoolean(git.commit, 'git.commit')
  requireString(git.commitMessage, 'git.commitMessage')
  optionalArgs(git.commitArgs, 'git.commitArgs')
  requireBoolean(git.push, 'git.push')
  requireArgs(git.pushArgs, 'git.pushArgs')

  if (git.changelog !== false) {
    const changelog = requireRecord(git.changelog, 'git.changelog')
    requireString(changelog.filename, 'git.changelog.filename')
    requireString(changelog.placeholder, 'git.changelog.placeholder')
    optionalString(changelog.preset, 'git.changelog.preset')
  }

  const npm = requireRecord(config.npm, 'npm')
  optionalString(npm.registry, 'npm.registry')
  requireBoolean(npm.requireOwner, 'npm.requireOwner')
  requirePositiveInteger(npm.networkConcurrency, 'npm.networkConcurrency')
  optionalBoolean(npm.prerelease, 'npm.prerelease')
  optionalString(npm.prereleaseId, 'npm.prereleaseId')
  requireBoolean(npm.canary, 'npm.canary')
  requireBoolean(npm.confirm, 'npm.confirm')
  optionalArgs(npm.publishArgs, 'npm.publishArgs')

  if (
    typeof npm.prereleaseId === 'string' &&
    (!/^[0-9A-Za-z-]+$/.test(npm.prereleaseId) ||
      npm.prereleaseId === 'latest' ||
      Boolean(semver.validRange(npm.prereleaseId)))
  ) {
    throw invalidConfig(
      'npm.prereleaseId',
      'a single non-numeric prerelease identifier that is safe as an npm dist-tag',
    )
  }

  if (
    npm.canary &&
    typeof npm.prereleaseId === 'string' &&
    npm.prereleaseId !== 'canary'
  ) {
    throw invalidConfig(
      'npm.prereleaseId',
      '`canary` when `npm.canary` is enabled',
    )
  }

  if (
    npm.prerelease === false &&
    (npm.canary || typeof npm.prereleaseId === 'string')
  ) {
    throw invalidConfig(
      'npm.prerelease',
      'a value other than `false` when a prerelease mode is configured',
    )
  }

  const github = requireRecord(config.github, 'github')
  requireBoolean(github.release, 'github.release')
  requireEnum(github.mode, 'github.mode', ['browser', 'api'])
  requireString(github.tokenEnv, 'github.tokenEnv')

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(github.tokenEnv)) {
    throw invalidConfig('github.tokenEnv', 'a valid environment variable name')
  }

  return input as ResolvedConfig
}

function requireEnum<const T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
): asserts value is T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw invalidConfig(
      path,
      `one of ${allowed.map(item => `\`${item}\``).join(', ')}`,
    )
  }
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidConfig(path, 'an object')
  }

  return value as Record<string, unknown>
}

function requireString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw invalidConfig(path, 'a non-empty string')
  }
}

function optionalString(
  value: unknown,
  path: string,
): asserts value is string | undefined {
  if (value !== undefined) {
    requireString(value, path)
  }
}

function requireBoolean(
  value: unknown,
  path: string,
): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw invalidConfig(path, 'a boolean')
  }
}

function requirePositiveInteger(
  value: unknown,
  path: string,
): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw invalidConfig(path, 'a positive integer')
  }
}

function optionalBoolean(
  value: unknown,
  path: string,
): asserts value is boolean | undefined {
  if (value !== undefined) {
    requireBoolean(value, path)
  }
}

function requireArgs(
  value: unknown,
  path: string,
): asserts value is string | string[] {
  if (
    typeof value !== 'string' &&
    (!Array.isArray(value) || value.some(item => typeof item !== 'string'))
  ) {
    throw invalidConfig(path, 'a string or an array of strings')
  }
}

function optionalArgs(
  value: unknown,
  path: string,
): asserts value is string | string[] | undefined {
  if (value !== undefined) {
    requireArgs(value, path)
  }
}

function invalidConfig(path: string, expected: string): AppError {
  return new AppError(
    `Invalid release config \`${path}\`, expected ${expected}.`,
  )
}
