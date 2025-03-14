import {
  chalk,
  logger,
  minimist,
  readJson,
  type PackageJson,
} from '@eljs/utils'
import { Command, InvalidArgumentError, program } from 'commander'
import path from 'path'
import semver, { RELEASE_TYPES, type ReleaseType } from 'semver'
import { Runner } from './runner'

cli()

async function cli() {
  const pkg = await readJson<PackageJson>(
    path.join(__dirname, '../package.json'),
  )
  program
    .version(
      pkg.version as string,
      '-v, --version',
      'Output the current version.',
    )
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

  const options = program.opts()
  const version = program.args[0]
  return new Runner(options).run(version).then(() => process.exit(0))
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
    throw new InvalidArgumentError('Should be a valid semantic version.')
  }

  // if startsWith 'v', need to remove it
  if (value.indexOf('v') === 0) {
    return value.substring(1)
  }

  return value
}
