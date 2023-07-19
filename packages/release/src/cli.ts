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
    .option('--tag <tag>', 'Npm publish tag.')
    .option(
      '--target-version <target-version>',
      'Target release version.',
      checkVersion,
    )
    .option('--no-git-checks', 'No check the git status and remote.')
    .option('--no-registry-checks', 'No check the package registry.')
    .option('--no-github-release', 'No release to github when publish down.')
    .option('--sync-cnpm', 'Sync to cnpm when publish done.')
    .option('--ownership-checks', 'Check the npm ownership.')
    .option('--verbose', 'Whether print verbose message.')
    .option('--print', 'Just print published package info.')
    .option('--latest', 'Whether generate latest changelog.')
    .option('--repo-type <repo-type>', 'Publish type, github or gitlab.')
    .option('--repo-url <repo-url>', 'Github repo url to release.')
    .option(
      '--changelog-preset <changelog-preset>',
      'Customize conventional changelog preset.',
    )

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

  if (opts.repoType && !['github', 'gitlab'].includes(opts.repoType)) {
    logger.printErrorAndExit(
      `Expected the --repo-type as github or gitlab, but got ${opts.repoType}.`,
    )
  }

  if (opts.tag && !['alpha', 'beta', 'next'].includes(opts.tag)) {
    logger.printErrorAndExit(
      `Expected the --tag as alpha beta or next, but got ${opts.tag}.`,
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
