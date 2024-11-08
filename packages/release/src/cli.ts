import { chalk, logger, minimist, readJSONSync } from '@eljs/utils'
import { InvalidArgumentError, program } from 'commander'
import path from 'path'
import semver, { RELEASE_TYPES, type ReleaseType } from 'semver'
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
      '--registry <registry>',
      'Specify the npm registry when publishing.',
    )
    .option(
      '--preid <preid>',
      'Specify the prerelease identifier when publishing a prerelease.',
    )
    .option('--independent', 'Tag published package independent.')
    .option(
      '--dry',
      'Instead of executing, display details about the affected packages that would be publish.',
    )
    .option('--verbose', 'Whether display verbose message.')
    .option('--latest', 'Whether generate latest changelog.')
    .option('--publish-only', 'Whether publish only.')
    .option('--sync-cnpm', 'Whether sync to cnpm when publish done.')
    .option('--no-confirm', 'No confirm the bump version.')
    .option('--no-ownership-check', 'No check the npm ownership.')
    .option('--no-git-check', 'No check the git status.')
    .option('--no-git-push', 'No push commit to git remote.')
    .option('--no-create-release', 'No release to git client.')
    .option('--branch <branch>', 'Limit the branch allowed to publish.')
    .option(
      '--repo-type <repo-type>',
      'Publish packages with the specified git type.',
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

  const opts = program.opts()
  const version = program.args[0]

  if (opts.preid && !['alpha', 'beta', 'rc', 'canary'].includes(opts.preid)) {
    logger.printErrorAndExit(
      `Expected the --preid as alpha beta rc or canary, but got ${opts.preid}.`,
    )
  }

  return release({
    ...opts,
    version,
  }).then(() => process.exit(0))
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

function checkVersion(value: ReleaseType) {
  if (RELEASE_TYPES.includes(value)) {
    return value
  }

  if (!semver.valid(value)) {
    throw new InvalidArgumentError('should be a valid semantic version.')
  }

  // if startsWith 'v', need to remove it
  if (value.indexOf('v') === 0) {
    return value.substring(1)
  }

  return value
}
