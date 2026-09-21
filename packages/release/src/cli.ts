import { notifyUpdates, runCliProcess } from '@eljs/utils/cli'
import { readJson } from '@eljs/utils/file'
import { createDebugger } from '@eljs/utils/logger'
import type { PackageJson } from '@eljs/utils/types'
import { InvalidArgumentError, program } from 'commander'
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

async function main(signal: AbortSignal) {
  const debug = createDebugger('release:cli')
  const packageJsonPath =
    typeof __dirname === 'string'
      ? path.join(__dirname, '../package.json')
      : fileURLToPath(new URL('../package.json', import.meta.url))

  const pkg = await readJson<Required<PackageJson>>(packageJsonPath)

  notifyUpdates({ pkg, argv: process.argv, debug })

  program
    .name('release')
    .description('Run a programmable npm release workflow')
    .version(pkg.version, '-v, --version', 'Output the current version')
    .argument('[version]', 'Specify the bump version', checkVersion)
    .option('--cwd <cwd>', 'Specify the working directory')
    .option(
      '--dry-run',
      'Validate and preview without publishing or modifying project files',
    )
    .option('--retry', 'Retry the release version from the release tag at HEAD')
    .option('--git.independent', 'Generate git tag independent')
    .option('--no-git.requireClean', 'Skip git working tree clean check')
    .option('--no-git.changelog', 'Skip changelog generation')
    .option('--no-git.commit', 'Skip git commit')
    .option('--no-git.push', 'Skip git push')
    .option(
      '--git.requireBranch <requireBranch>',
      'Require that the release is on a particular branch',
    )
    .option('--npm.prerelease', 'Specify the release type as prerelease')
    .option('--npm.canary', 'Specify the release type as canary')
    .option('--npm.registry <registry>', 'Specify the npm registry')
    .option('--no-npm.requireOwner', 'Skip npm owner check')
    .option('--no-npm.confirm', 'Skip confirm bump version')
    .option('--npm.prereleaseId <prereleaseId>', 'Specify the prereleaseId')
    .option('--no-github.release', 'Skip github release')
    .option(
      '--github.mode <mode>',
      'Create GitHub releases through browser or api',
    )
    .action(async (version, opts) => {
      debug?.(`version:`, version)
      debug?.(`opts:%O`, opts)
      // retry 的目标版本只能由本地发布标签决定，显式版本与自动发现互相矛盾
      if (version && opts.retry) {
        throw new InvalidArgumentError(
          '--retry cannot be combined with a version argument',
        )
      }
      const options = parseOptions(opts)
      debug?.(`options:%O`, options)
      await release(version, { ...options, signal })
    })

  program.showHelpAfterError()
  await program.parseAsync(process.argv)
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

/**
 * CLI 点分路径选项解析期间使用的递归对象容器
 *
 * @internal
 */
type NestedObject = Record<string, unknown>

function parseOptions<T extends NestedObject = NestedObject>(
  options: T,
): NestedObject {
  const result: NestedObject = {}

  for (const [path, value] of Object.entries(options)) {
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

  const git = isNestedObject(result.git) ? result.git : {}
  const npm = isNestedObject(result.npm) ? result.npm : {}
  const github = isNestedObject(result.github) ? result.github : {}

  for (const key of Object.keys(git)) {
    if (
      ['requireClean', 'changelog', 'commit', 'push'].includes(key) &&
      git[key] === true
    ) {
      Reflect.deleteProperty(git, key)
    }
  }

  for (const key of Object.keys(npm)) {
    if (['requireOwner', 'confirm'].includes(key) && npm[key] === true) {
      Reflect.deleteProperty(npm, key)
    }
  }

  if (github.release === true) {
    Reflect.deleteProperty(github, 'release')
  }

  return result
}

function isNestedObject(value: unknown): value is NestedObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
