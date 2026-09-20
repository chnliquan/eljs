import { notifyUpdates, runCliProcess } from '@eljs/utils/cli'
import { readJson } from '@eljs/utils/file'
import { createDebugger } from '@eljs/utils/logger'
import type { PackageJson } from '@eljs/utils/types'
import { Command } from 'commander'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ProjectCreator } from './core'
import { AppError } from './utils'

/**
 * 启动 create 命令行程序
 *
 * @returns 命令行流程 Promise
 */
export function cli(): Promise<void> {
  return runCliProcess({
    name: 'create',
    run: main,
    createCancelReason: signal =>
      new AppError(`Create operation received ${signal}`, {
        code: 'CREATE_OPERATION_CANCELLED',
        details: { signal },
      }),
    isCancellation,
  })
}

async function main(signal: AbortSignal) {
  const debug = createDebugger('create:cli')
  const packageJsonPath =
    typeof __dirname === 'string'
      ? path.join(__dirname, '../package.json')
      : fileURLToPath(new URL('../package.json', import.meta.url))
  const pkg = await readJson<Required<PackageJson>>(packageJsonPath)

  notifyUpdates({ pkg, argv: process.argv, debug })

  const command = new Command()
    .name('create')
    .description('Generate a project from a local, npm, or Git template')
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
        signal,
        template,
      }).run(projectName)
    })

  command.showHelpAfterError()
  await command.parseAsync(process.argv)
}

function isCancellation(error: unknown): boolean {
  return (
    error instanceof AppError &&
    (error.code === 'CREATE_OPERATION_ABORTED' ||
      error.code === 'CREATE_OPERATION_CANCELLED')
  )
}
