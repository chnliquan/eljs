import { chalk, logger, readJSONSync } from '@eljs/utils'
import { InvalidOptionArgumentError, program } from 'commander'
import path from 'path'
import semver from 'semver'
import { release } from './core/release'

cli().catch((err: Error) => {
  console.error(`release failed, ${err.message}`)
  console.error(err)
})

function cli() {
  const pkgJSON = readJSONSync(path.join(__dirname, '../package.json'))
  program
    .version(
      pkgJSON.version as string,
      '-v, --version',
      'Output the current version.',
    )
    .option(
      '--target-version <target-version>',
      'Target release version.',
      checkVersion,
    )
    .option(
      '--git-checks',
      'Check whether the current branch is release brach.',
    )
    .option('--sync-cnpm', 'Sync to cnpm when publish done.')
    .option('--repo-type <repo-type>', 'Publish type, github or gitlab.')
    .option('--repo-url <repo-url>', 'Github repo url to release.')
    .option(
      '--changelog-preset <changelog-preset>',
      'Customize conventional changelog preset.',
    )
    .option('--latest', 'Generate latest changelog')

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

  const opts = program.opts()

  if (
    opts.repoType &&
    opts.repoType !== 'github' &&
    opts.repoType !== 'gitlab'
  ) {
    logger.printErrorAndExit(
      `Expected the --repo-type as github or gitlab, but got ${opts.repoType}.`,
    )
  }

  return release(opts).then(() => process.exit(0))
}

function enhanceErrorMessages(
  methodName: string,
  log: (...args: any[]) => void,
) {
  ;(program as any).Command.prototype[methodName] = function (...args: any[]) {
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

function checkVersion(value: string) {
  const isValid = Boolean(semver.valid(value))

  if (!isValid) {
    throw new InvalidOptionArgumentError(
      '--target-version need a valid semantic version.',
    )
  }

  // if startsWith 'v', need to remove it
  if (value.indexOf('v') === 0) {
    return value.substring(1)
  }

  return value
}
