#!/usr/bin/env node
'use strict'

const { program, InvalidOptionArgumentError } = require('commander')
const semver = require('semver')
const { logger, chalk } = require('@eljs/utils')

const { release } = require('../lib')
const pkg = require('../package.json')

run()

function checkVersion(value) {
  const isValid = Boolean(semver.valid(value))
  if (!isValid) {
    throw new InvalidOptionArgumentError('need a valid semantic version')
  }

  // if startsWith 'v', need to remove it
  if (value.indexOf('v') === 0) return value.substring(1)
  return value
}

function run() {
  program
    .version(pkg.version, '-v, --version', 'Output the current version.')
    .option('-t, --repo-type <repo-type>', 'Publish type, github or gitlab.')
    .option('-u, --repo-url <repo-url>', 'Github repo url to release.')
    .option(
      '-p, --changelog-preset <changelog-preset>',
      'Customize conventional changelog preset.',
    )
    .option(
      '--target-version <target-version>',
      'Target release version.',
      checkVersion,
    )
    .option('--git-checks', 'Check whether the current branch is release brach')
    .option('--latest', 'Generate latest changelog', true)

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

  const { repoType } = program._optionValues

  if (repoType && repoType !== 'github' && repoType !== 'gitlab') {
    logger.printErrorAndExit(
      `Expected the --repo-type as github or gitlab, but got ${repoType}.`,
    )
  }

  release(program._optionValues)
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
}

function enhanceErrorMessages(methodName, log) {
  program.Command.prototype[methodName] = function (...args) {
    if (methodName === 'unknownOption' && this._allowUnknownOption) {
      return
    }

    this.outputHelp()

    console.log(`  ` + chalk.red(log(...args)))
    console.log()
    process.exit(1)
  }
}
