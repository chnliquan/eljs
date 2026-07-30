import { createDebugger, readJson, type PackageJson } from '@eljs/utils'
import { program } from 'commander'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import updateNotifier from 'update-notifier'

import { CreateTemplate } from './create'
import { onCancel } from './utils'

export async function cli() {
  registerSignalHandler()

  try {
    await main()
    process.exit(0)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

function registerSignalHandler() {
  if (!process.listeners('SIGINT').includes(handleSigint)) {
    process.on('SIGINT', handleSigint)
  }
}

function handleSigint() {
  onCancel()
}

async function main() {
  const debug = createDebugger('create-template:cli')
  const packageJsonPath =
    typeof __dirname === 'string'
      ? path.join(__dirname, '../package.json')
      : fileURLToPath(new URL('../package.json', import.meta.url))
  const pkg = await readJson<Required<PackageJson>>(packageJsonPath)

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
    .option(
      '--allow-template-scripts',
      'Allow lifecycle scripts while installing template dependencies',
    )
    .action(async (projectName, options) => {
      debug?.(`projectName:`, projectName)
      debug?.(`options:%O`, options)
      await new CreateTemplate(options).run(projectName)
    })

  program.showHelpAfterError()
  await program.parseAsync(process.argv)
}
