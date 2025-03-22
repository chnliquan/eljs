import { chalk, createDebugger, readJson, type PackageJson } from '@eljs/utils'
import { Command, InvalidArgumentError, program } from 'commander'
import path from 'node:path'
import semver, { RELEASE_TYPES, type ReleaseType } from 'semver'
import updateNotifier from 'update-notifier'

import { release } from './release'
import { onCancel } from './utils'

const debug = createDebugger('release:cli')

cli()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

process.on('SIGINT', () => {
  onCancel()
})

async function cli() {
  const pkg = await readJson<Required<PackageJson>>(
    path.join(__dirname, '../package.json'),
  )

  updateNotifier({ pkg }).notify()

  program
    .name('release')
    .description('Release npm package easily.')
    .version(pkg.version, '-v, --version', 'Output the current version.')
    .argument('[version]', 'Specify the bump version.', checkVersion)
    .option('--cwd <cwd>', 'Specify the working directory.')
    .option('--git.independent', 'Generate git tag independent.')
    .option('--no-git.requireClean', 'Skip check git working tree clean.')
    .option('--no-git.changelog', 'Skip generate changelog.')
    .option('--no-git.commit', 'Skip the commit release step.')
    .option('--no-git.push', 'Skip the push release step.')
    .option(
      '--git.requireBranch <requireBranch>',
      'Require that the release is on a particular branch.',
    )
    .option('--npm.prerelease', 'Specify the release type as prerelease.')
    .option('--npm.canary', 'Specify the release type as canary.')
    .option('--npm.cnpm', 'Sync to cnpm when release done.')
    .option('--no-npm.requireOwner', 'Skip check npm owner step.')
    .option('--no-npm.confirm', 'Skip the confirm bump version release step.')
    .option('--npm.prereleaseId <prereleaseId>', 'Specify the prereleaseId.')
    .option('--no-github.release', 'Skip the github release step.')
    .action(async (version, opts) => {
      debug?.(`version:`, version)
      debug?.(`opts:%O`, opts)
      const options = parseOptions(opts)
      debug?.(`options:%O`, options)
      await release(version, options)
    })

  // https://github.com/tj/commander.js/blob/master/lib/command.js#L1994
  enhanceErrorMessages('missingArgument', argName => {
    return `Missing required argument ${chalk.yellow(`<${argName}>`)}.`
  })

  // https://github.com/tj/commander.js/blob/master/lib/command.js#L2074
  enhanceErrorMessages('unknownOption', optionName => {
    return `Unknown option ${chalk.yellow(optionName)}.`
  })

  // https://github.com/tj/commander.js/blob/master/lib/command.js#L2006
  enhanceErrorMessages('optionMissingArgument', (option, flag) => {
    return (
      `Missing required argument for option ${chalk.yellow(option.flags)}` +
      (flag ? `, got ${chalk.yellow(flag)}` : ``)
    )
  })

  enhanceExcessArguments()

  await program.parseAsync(process.argv)
}

function enhanceErrorMessages(
  methodName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log: (...args: any[]) => void,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(Command['prototype'] as any)[methodName] = function (...args: any[]) {
    if (methodName === 'unknownOption' && this._allowUnknownOption) {
      return
    }

    this.outputHelp()

    console.log()
    console.log(`  ` + chalk.red(log(...args)))
    console.log()
    process.exit(1)
  }
}

function enhanceExcessArguments() {
  // https://github.com/tj/commander.js/blob/master/lib/command.js#L2106
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(Command['prototype'] as any)['_excessArguments'] = function (
    receivedArgs: string[],
  ) {
    if (this._allowExcessArguments) return

    const expected = this.registeredArguments.length
    const s = expected === 1 ? '' : 's'
    const message = `Expected ${expected} argument${s} but got ${chalk.yellow(receivedArgs.length)}.`

    this.outputHelp()

    console.log()
    console.log(`  ` + chalk.red(message))
    console.log()
    process.exit(1)
  }
}

function checkVersion(value: ReleaseType) {
  if (RELEASE_TYPES.includes(value)) {
    return value
  }

  if (!semver.valid(value)) {
    throw new InvalidArgumentError(
      `Should be a valid semantic version, but got ${value}.`,
    )
  }

  // if startsWith 'v', need to remove it
  if (value.indexOf('v') === 0) {
    return value.substring(1)
  }

  return value
}

interface NestedObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

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
        current = current[key]
      }
    }
  }

  const { git, npm } = result

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

  return result
}
