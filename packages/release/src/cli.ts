import { readJson } from '@eljs/utils/file'
import { createDebugger, logger } from '@eljs/utils/logger'
import type { PackageJson } from '@eljs/utils/types'
import { InvalidArgumentError, program } from 'commander'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import semver, { type ReleaseType } from 'semver'
import updateNotifier from 'update-notifier'

import { release } from './release'
import { AppError, onCancel } from './utils'

const { RELEASE_TYPES } = semver

/**
 * 启动 release 命令行程序
 *
 * @returns 命令行流程 Promise
 */
export function cli(): Promise<void> {
  registerSignalHandler()

  return main()
    .then(() => process.exit(0))
    .catch(error => {
      if (error instanceof AppError) {
        logger.error(error.message)
      } else {
        console.error(error)
      }
      process.exit(1)
    })
}

function registerSignalHandler() {
  if (!process.listeners('SIGINT').includes(handleSigint)) {
    process.on('SIGINT', handleSigint)
  }
}

function handleSigint() {
  onCancel()
}

async function main() {
  const debug = createDebugger('release:cli')
  const packageJsonPath =
    typeof __dirname === 'string'
      ? path.join(__dirname, '../package.json')
      : fileURLToPath(new URL('../package.json', import.meta.url))

  const pkg = await readJson<Required<PackageJson>>(packageJsonPath)

  updateNotifier({ pkg }).notify()

  program
    .name('release')
    .description('Release npm package easily')
    .version(pkg.version, '-v, --version', 'Output the current version')
    .argument('[version]', 'Specify the bump version', checkVersion)
    .option('--cwd <cwd>', 'Specify the working directory')
    .option(
      '--dry-run',
      'Validate and preview without publishing or modifying project files',
    )
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
    .option(
      '--npm.networkConcurrency <count>',
      'Limit concurrent npm registry requests',
      parsePositiveInteger,
    )
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
      const options = parseOptions(opts)
      debug?.(`options:%O`, options)
      await release(version, options)
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

function parsePositiveInteger(value: string): number {
  const number = Number(value)

  if (!Number.isInteger(number) || number < 1) {
    throw new InvalidArgumentError('Expected a positive integer.')
  }

  return number
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
