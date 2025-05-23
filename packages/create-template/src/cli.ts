import { chalk, createDebugger, readJson, type PackageJson } from '@eljs/utils'
import { Command, program } from 'commander'
import path from 'node:path'
import updateNotifier from 'update-notifier'

import { CreateTemplate } from './create'
import { onCancel } from './utils'

const debug = createDebugger('create-template:cli')

cli()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
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
    .name('create-template')
    .description('Create a new project powered by @eljs/create')
    .version(pkg.version, '-v, --version', 'Output the current version')
    .argument('<project-name>', 'Project name')
    .option('--cwd <cwd>', 'Specify the working directory')
    .option('-s, --scene <scene>', 'Specify a application scene')
    .option('-t, --template <template>', 'Specify a application template')
    .option('-f, --force', 'Overwrite target directory if it exists')
    .option('-m, --merge', 'Merge target directory if it exists')
    .action(async (projectName, options) => {
      debug?.(`projectName:`, projectName)
      debug?.(`options:%O`, options)
      await new CreateTemplate(options).run(projectName)
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
