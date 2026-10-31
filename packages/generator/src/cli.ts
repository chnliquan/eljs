import { notifyUpdates, runCliProcess } from '@eljs/utils/cli'
import { readJson } from '@eljs/utils/file'
import { createDebugger } from '@eljs/utils/logger'
import type { PackageJson } from '@eljs/utils/types'
import { Command } from 'commander'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ProjectGenerator } from './core'
import { AppError } from './utils'

/**
 * 启动支持本地、npm 与 Git 模板的 generator 命令行程序
 *
 * @returns 命令行流程 Promise
 */
export function cli(): Promise<void> {
  return runCliProcess({
    name: 'generator',
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
  const debug = createDebugger('generator:cli')
  const packageJsonPath =
    typeof __dirname === 'string'
      ? path.join(__dirname, '../package.json')
      : fileURLToPath(new URL('../package.json', import.meta.url))
  const pkg = await readJson<Required<PackageJson>>(packageJsonPath)

  notifyUpdates({ pkg, argv: process.argv, debug })

  const command = new Command()
    .name('generator')
    .description('Generate a project from a local, npm, or Git template')
    .version(pkg.version, '-v, --version', 'Output the current version')
    .arguments('<template> <project-name>')
    .option('--cwd <cwd>', 'Specify the working directory')
    .option('-f, --force', 'Overwrite target directory if it exists')
    .option('-m, --merge', 'Merge target directory if it exists')
    .option('--install', 'Install dependencies after create done', true)
    .option('--no-install', 'Skip install dependencies after create done')
    .option('-y, --yes', 'Trust and execute the selected remote template')
    .option(
      '--allow-template-scripts',
      'Allow lifecycle scripts while installing remote template dependencies',
    )
    .action(async (template, projectName, options, command) => {
      debug?.(`template:`, template)
      debug?.(`projectName:`, projectName)
      debug?.(`options:%O`, options)
      const creatorOptions = { ...options }

      // 只有 CLI 显式传递的值才能覆盖模版配置，commander 注入的默认值
      // 与未传递状态的 source 均不为 cli
      const source = command.getOptionValueSource('install')
      if (source !== 'cli' && source !== 'env') {
        delete creatorOptions.install
      }

      await new ProjectGenerator({
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
