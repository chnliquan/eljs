import { notifyUpdates, runCliProcess } from '@eljs/utils/cli'
import { readJson } from '@eljs/utils/file'
import { createDebugger } from '@eljs/utils/logger'
import type { PackageJson } from '@eljs/utils/types'
import { Command, InvalidArgumentError, Option } from 'commander'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import semver, { type ReleaseType } from 'semver'

import { release } from './release'
import { AppError } from './utils'

const { RELEASE_TYPES } = semver

/**
 * 启动 release 命令行程序
 *
 * @returns 命令行流程 Promise
 */
export function cli(): Promise<void> {
  return runCliProcess({
    name: 'release',
    run: main,
    createCancelReason: signal =>
      new AppError(`Release operation received ${signal}`),
    // release 的 AppError 尚无取消错误码，保留接口对齐以备未来接入
    isCancellation: () => false,
  })
}

/**
 * 构建已注册全部选项的 release 命令实例
 *
 * @remarks
 * 每次调用返回独立 commander 实例，主入口与集成测试复用同一套声明；
 * boolean 选项成对声明正反形式，未显式传递的值由 value-source 过滤，
 * 不会进入发布配置，因此 CLI 显式值始终优先于配置文件
 *
 * @param version - CLI 自身版本号
 * @param hooks - 主入口注入的信号与调试日志
 * @returns 已注册选项的 commander 实例
 *
 * @internal
 */
export function createProgram(
  version: string,
  hooks: {
    signal?: AbortSignal
    debug?: (formatter: string, ...args: unknown[]) => void
  } = {},
): Command {
  const program = new Command()

  program
    .name('release')
    .description('Run a programmable npm release workflow')
    .version(version, '-v, --version', 'Output the current version')
    .argument('[version]', 'Specify the bump version', checkVersion)
    .option('--cwd <cwd>', 'Specify the working directory')
    .option(
      '--dry-run',
      'Validate and preview without publishing or modifying project files',
    )
    .option('--retry', 'Retry the release version from the release tag at HEAD')
    .option(
      '--git.independent',
      'Generate one git tag per workspace package',
      false,
    )
    .option('--no-git.independent', 'Generate a single git tag')
    .option('--git.requireClean', 'Check git working tree is clean', true)
    .option('--no-git.requireClean', 'Skip git working tree clean check')
    .option('--git.commit', 'Commit version and changelog changes', true)
    .option('--no-git.commit', 'Skip git commit')
    .option('--git.push', 'Push commit and tags to remote', true)
    .option('--no-git.push', 'Skip git push')
    .option(
      '--git.requireBranch <branch>',
      'Require that the release is on a particular branch',
    )
    .option('--npm.prerelease', 'Specify the release type as prerelease', false)
    .option('--no-npm.prerelease', 'Release a stable version')
    .option('--npm.canary', 'Specify the release type as canary', false)
    .option('--no-npm.canary', 'Disable canary release')
    .option('--npm.registry <registry>', 'Specify the npm registry')
    .option('--npm.requireOwner', 'Require npm ownership of all packages', true)
    .option('--no-npm.requireOwner', 'Skip npm owner check')
    .option('--npm.confirm', 'Confirm bump version before publish', true)
    .option('--no-npm.confirm', 'Skip confirm bump version')
    .option(
      '--npm.prereleaseId <prereleaseId>',
      'Specify the prereleaseId',
      checkPrereleaseId,
    )
    .option('--github.release', 'Create GitHub Release', true)
    .option('--no-github.release', 'Skip GitHub release')
    .addOption(
      new Option(
        '--github.mode <mode>',
        'Create GitHub releases through browser or api',
      )
        .choices(['browser', 'api'])
        .default('browser'),
    )
    .showHelpAfterError()
    .action(async (version, opts, command) => {
      hooks.debug?.(`version:`, version)
      hooks.debug?.(`opts:%O`, opts)
      // retry 的目标版本只能由本地发布标签决定，显式版本与自动发现互相矛盾
      if (version && opts.retry) {
        throw new InvalidArgumentError(
          '--retry cannot be combined with a version argument',
        )
      }
      const options = parseOptions(opts, command)
      hooks.debug?.(`options:%O`, options)
      await release(version, { ...options, signal: hooks.signal })
    })

  return program
}

async function main(signal: AbortSignal) {
  const debug = createDebugger('release:cli')
  const packageJsonPath =
    typeof __dirname === 'string'
      ? path.join(__dirname, '../package.json')
      : fileURLToPath(new URL('../package.json', import.meta.url))

  const pkg = await readJson<Required<PackageJson>>(packageJsonPath)

  notifyUpdates({ pkg, argv: process.argv, debug })
  await createProgram(pkg.version, { signal, debug }).parseAsync(process.argv)
}

function checkVersion(value: string): string {
  if (RELEASE_TYPES.includes(value as ReleaseType)) {
    return value
  }

  if (!semver.valid(value)) {
    throw new InvalidArgumentError(`Invalid semantic version \`${value}\`.`)
  }

  // if startsWith 'v', need to remove it
  if (value.indexOf('v') === 0) {
    return value.substring(1)
  }

  return value
}

function checkPrereleaseId(value: string): string {
  if (
    !/^[0-9A-Za-z-]+$/.test(value) ||
    value === 'latest' ||
    Boolean(semver.validRange(value))
  ) {
    throw new InvalidArgumentError(
      `Expected a single non-numeric prerelease identifier that is safe as an npm dist-tag.`,
    )
  }
  return value
}

/**
 * CLI 点分路径选项解析期间使用的递归对象容器
 *
 * @internal
 */
type NestedObject = Record<string, unknown>

/**
 * 收集 commander 解析后 source 为显式传递的选项键
 *
 * @param command - 已完成解析的命令实例
 * @returns source 为 cli 或 env 的点分选项键集合
 */
function collectExplicitKeys(
  command: Pick<Command, 'options' | 'getOptionValueSource'>,
): Set<string> {
  const explicitKeys = new Set<string>()

  for (const option of command.options) {
    const attributeName = option.attributeName()
    if (explicitKeys.has(attributeName)) {
      continue
    }
    const source = command.getOptionValueSource(attributeName)
    if (source === 'cli' || source === 'env') {
      explicitKeys.add(attributeName)
    }
  }

  return explicitKeys
}

/**
 * 将点分选项键递归展开为嵌套配置对象
 *
 * @param options - commander 解析得到的平铺选项
 * @param command - 已完成解析的命令实例，用于过滤默认注入值
 * @returns 仅包含 CLI 显式传递值的嵌套配置
 */
function parseOptions(
  options: Record<string, unknown>,
  command: Pick<Command, 'options' | 'getOptionValueSource'>,
): NestedObject {
  const result: NestedObject = {}
  const explicitKeys = collectExplicitKeys(command)

  for (const [path, value] of Object.entries(options)) {
    if (!explicitKeys.has(path)) {
      continue
    }

    if (!path.includes('.')) {
      result[path] = value
      continue
    }

    const keys = path.split('.').filter(Boolean)
    let current = result

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      if (i === keys.length - 1) {
        current[key] = value
      } else {
        current[key] = current[key] || {}
        current = current[key] as NestedObject
      }
    }
  }

  return result
}
