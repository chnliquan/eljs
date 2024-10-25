import { chalk, logger, minimist, readJSONSync } from '@eljs/utils'
import { InvalidArgumentError, program } from 'commander'
import path from 'path'
import semver from 'semver'
import { VERSION_TAGS } from './constants'
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
    .option('--no-registry-check', 'No check the package registry.')
    .option('--no-git-check', 'No check the git status.')
    .option('--no-git-push', 'No push commit to git remote.')
    .option('--no-create-release', 'No release to git client.')
    .option('--branch <branch>', 'Limit the branch  allowed to publish.')
    .option(
      '--dist-tag <dist-tag>',
      'Publish packages with the specified npm dist-tag.',
    )
    .option(
      '--repo-type <repo-type>',
      'Publish packages with the specified git type.',
    )
    .argument('[version]', 'Customize bump version.', checkVersion)

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

function checkVersion(value: string) {
  if (VERSION_TAGS.includes(value as any)) {
    return value
  }

  const isValid = Boolean(semver.valid(value))

  if (!isValid) {
    throw new InvalidArgumentError('should be a valid semantic version.')
  }

  // if startsWith 'v', need to remove it
  if (value.indexOf('v') === 0) {
    return value.substring(1)
  }

  return value
}
