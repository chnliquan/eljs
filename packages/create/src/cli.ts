import { AppError } from '@eljs/generator/errors'
import { notifyUpdates, runCliProcess } from '@eljs/utils/cli'
import { readJson } from '@eljs/utils/file'
import { createDebugger } from '@eljs/utils/logger'
import type { PackageJson } from '@eljs/utils/types'
import { Command } from 'commander'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 启动使用官方模板初始化项目的 create 命令行程序
 *
 * @returns 命令行流程 Promise
 */
export async function cli(): Promise<void> {
  return runCliProcess({
    name: 'create',
    run: main,
    createCancelReason: signal =>
      new AppError(`Create template operation received ${signal}`, {
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
    .description('Initialize a project from an official template')
    .version(pkg.version, '-v, --version', 'Output the current version')
    .argument('<project-name>', 'Project name')
    .option('--cwd <cwd>', 'Specify the working directory')
    .option('-t, --template <template>', 'Specify an application template')
    .option('-f, --force', 'Overwrite target directory if it exists')
    .option('-m, --merge', 'Merge target directory if it exists')
    .option(
      '--allow-template-scripts',
      'Allow lifecycle scripts while installing template dependencies',
    )
    .action(async (projectName, options) => {
      debug?.(`projectName:`, projectName)
      debug?.(`options:%O`, options)
      const { ProjectCreator } = await import('./create')
      await new ProjectCreator({ ...options, signal }).run(projectName)
    })
    .showHelpAfterError()

  await command.parseAsync(process.argv)
}

function isCancellation(error: unknown): boolean {
  return (
    error instanceof AppError &&
    (error.code === 'CREATE_OPERATION_ABORTED' ||
      error.code === 'CREATE_OPERATION_CANCELLED')
  )
}
