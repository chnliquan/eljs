import { chalk, isPathExistsSync, logger, readJSONSync } from '@eljs/utils'
import { program } from 'commander'
import path from 'path'
import { defaultTemplateConfig } from './config'
import { CreateTemplate } from './create'
import type { TemplateConfig } from './types'

cli()

async function cli() {
  const pkgJSON = readJSONSync(path.join(__dirname, '../package.json'))
  program
    .version(
      pkgJSON.version as string,
      '-v, --version',
      'Output the current version.',
    )
    .option('-c, --template-config <template-config>', 'Template config path.')
    .option('-t, --app-type <app-type>', 'Template app type.')
    .option('-n, --app-name <app-name>', 'Template app name.')
    .option('-f, --force', 'Override when dest exists file.')

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

  if (!program.args.length) {
    logger.printErrorAndExit('Missing project name.')
  }

  const opts = program.opts()
  let templateConfig: TemplateConfig = defaultTemplateConfig

  if (opts.templateConfig) {
    if (!isPathExistsSync(opts.templateConfig)) {
      logger.printErrorAndExit(`${opts.templateConfig} is not exist.`)
    }

    templateConfig = require(opts.templateConfig)
  }

  return new CreateTemplate({
    ...opts,
    args: opts,
    templateConfig,
  }).run(program.args[0])
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
