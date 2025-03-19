import {
  chalk,
  isPathExistsSync,
  logger,
  readJson,
  type PackageJson,
} from '@eljs/utils'
import { Command, program } from 'commander'
import path from 'node:path'
import updater from 'update-notifier'

import { defaultTemplateConfig } from './config'
import { CreateTemplate } from './create'
import type { TemplateConfig } from './types'

cli()

async function cli() {
  const pkg = await readJson<Required<PackageJson>>(
    path.join(__dirname, '../package.json'),
  )
  program
    .version(pkg.version, '-v, --version', 'Output the current version.')
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      `Missing required argument for option ${chalk.yellow((option as any).flags)}` +
      (flag ? `, got ${chalk.yellow(flag)}` : ``)
    )
  })

  program.parse(process.argv)

  if (!program.args.length) {
    logger.printErrorAndExit('Missing project name.')
  }

  const options = program.opts()
  let templateConfig: TemplateConfig = defaultTemplateConfig

  if (options.templateConfig) {
    if (!isPathExistsSync(options.templateConfig)) {
      logger.printErrorAndExit(`${options.templateConfig} is not exist.`)
    }

    templateConfig = require(options.templateConfig)
  }

  updater({ pkg }).notify()

  return new CreateTemplate({
    ...options,
    templateConfig,
  }).run(program.args[0])
}

function enhanceErrorMessages(
  methodName: string,
  log: (...args: unknown[]) => void,
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
