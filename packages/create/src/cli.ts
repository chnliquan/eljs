import { createDebugger, logger, readJson, type PackageJson } from '@eljs/utils'
import { program } from 'commander'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import updateNotifier from 'update-notifier'

import { ProjectCreator } from './core'
import { AppError, onCancel } from './utils'

/**
 * 启动 create 命令行程序
 *
 * @returns 命令行流程 Promise
 */
export function cli(): Promise<void> {
  registerSignalHandler()

  return main()
    .then(() => process.exit(0))
    .catch(error => {
      if (error instanceof AppError) {
        logger.error(error.message)
      } else {
        console.error(error)
      }
      process.exit(1)
    })
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
  const debug = createDebugger('create:cli')
  const packageJsonPath =
    typeof __dirname === 'string'
      ? path.join(__dirname, '../package.json')
      : fileURLToPath(new URL('../package.json', import.meta.url))
  const pkg = await readJson<Required<PackageJson>>(packageJsonPath)

  updateNotifier({ pkg }).notify()

  program
    .name('create')
    .description('Create a project from a remote template')
    .version(pkg.version, '-v, --version', 'Output the current version')
    .arguments('<template> <project-name>')
    .option('--cwd <cwd>', 'Specify the working directory')
    .option('-f, --force', 'Overwrite target directory if it exists')
    .option('-m, --merge', 'Merge target directory if it exists')
    .option('--no-install', 'Skip install dependencies after create done')
    .option('-y, --yes', 'Trust and execute the selected remote template')
    .option(
      '--allow-template-scripts',
      'Allow lifecycle scripts while installing remote template dependencies',
    )
    .action(async (template, projectName, options) => {
      debug?.(`template:`, template)
      debug?.(`projectName:`, projectName)
      debug?.(`options:%O`, options)
      const creatorOptions = { ...options }

      // Commander 会为否定选项注入 true 默认值，只有 false 才表示用户显式覆盖模版配置
      if (creatorOptions.install !== false) {
        delete creatorOptions.install
      }

      await new ProjectCreator({
        ...creatorOptions,
        template,
      }).run(projectName)
    })

  program.showHelpAfterError()
  await program.parseAsync(process.argv)
}
