import { chalk, logger, readJson, type PackageJson } from '@eljs/utils'
import { Command, InvalidArgumentError, program } from 'commander'
import minimist from 'minimist'
import path from 'node:path'
import semver, { RELEASE_TYPES, type ReleaseType } from 'semver'
import updater from 'update-notifier'
import { release } from './release'

cli()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

async function cli() {
  const pkg = await readJson<Required<PackageJson>>(
    path.join(__dirname, '../package.json'),
  )
  program
    .version(pkg.version, '-v, --version', 'Output the current version.')
    .option('--git.skipCheck', 'Skip git npm.')
    .option('--git.independent', 'Generate git tag independent.')
    .option('--no-git.changelog', 'Skip generate changelog.')
    .option('--no-git.push', 'Skip push commit to remote.')
    .option('--npm.skipCheck', 'Skip check npm.')
    .option('--npm.prerelease', 'Use prerelease type.')
    .option('--npm.prereleaseId <prereleaseId>', 'Specify the prereleaseId.')
    .option('--npm.canary', 'Use canary type.')
    .option('--npm.cnpm', 'Sync to cnpm.')
    .option('--no-npm.confirm', 'Skip confirm the bump version.')
    .option('--no-github.release', 'Skip github release.')
    .argument('[version]', 'Specify the bump version.', checkVersion)

  program.commands.forEach(c => c.on('--help', () => console.log()))

  enhanceErrorMessages('missingArgument', argName => {
    return `Missing required argument ${chalk.yellow(`<${argName}>`)}.`
  })

  enhanceErrorMessages('unknownOption', optionName => {
    return `Unknown option ${chalk.yellow(optionName)}.`
  })

  enhanceErrorMessages('optionMissingArgument', (option, flag) => {
    return (
      `Missing required argument for option ${chalk.yellow(option.flags)}` +
      (flag ? `, got ${chalk.yellow(flag)}` : ``)
    )
  })

  program.parse(process.argv)

  if (minimist(process.argv.slice(3))._.length > 1) {
    logger.info(
      'You provided more than one argument. The first one will be used as the bump version, the rest are ignored.',
    )
  }

  updater({ pkg }).notify()
  const options = parseOptions(program.opts())
  const version = program.args[0]
  await release(version, options)
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

  console.log(options)
  console.log(result)

  return result
}
