import { AppError } from '@eljs/create'
import { readJson } from '@eljs/utils/file'
import { createDebugger, logger } from '@eljs/utils/logger'
import type { PackageJson } from '@eljs/utils/types'
import { program } from 'commander'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { CreateTemplate } from './create'

export async function cli() {
  const controller = new AbortController()
  const disposeSignalHandlers = registerSignalHandlers(controller)

  try {
    await main(controller.signal)
    if (controller.signal.aborted) {
      throw controller.signal.reason
    }
  } catch (error) {
    if (isCancellation(error) || controller.signal.aborted) {
      process.exitCode = 130
    } else if (error instanceof AppError) {
      logger.error(error.message)
      process.exitCode = 1
    } else {
      console.error(error)
      process.exitCode = 1
    }
  } finally {
    disposeSignalHandlers()
  }
}

function registerSignalHandlers(controller: AbortController): () => void {
  const handleSignal = (signal: NodeJS.Signals) => {
    if (!controller.signal.aborted) {
      logger.event(`Cancelling create template after ${signal}`)
      controller.abort(
        new AppError(`Create template operation received ${signal}`, {
          code: 'CREATE_OPERATION_CANCELLED',
          details: { signal },
        }),
      )
      return
    }

    process.exit(130)
  }

  process.on('SIGINT', handleSignal)
  process.on('SIGTERM', handleSignal)

  return () => {
    process.off('SIGINT', handleSignal)
    process.off('SIGTERM', handleSignal)
  }
}

function isCancellation(error: unknown): boolean {
  return (
    error instanceof AppError &&
    (error.code === 'CREATE_OPERATION_ABORTED' ||
      error.code === 'CREATE_OPERATION_CANCELLED')
  )
}

async function main(signal: AbortSignal) {
  const debug = createDebugger('create-template:cli')
  const packageJsonPath =
    typeof __dirname === 'string'
      ? path.join(__dirname, '../package.json')
      : fileURLToPath(new URL('../package.json', import.meta.url))
  const pkg = await readJson<Required<PackageJson>>(packageJsonPath)

  if (shouldCheckForUpdates(process.argv)) {
    const { default: updateNotifier } = await import('update-notifier')
    updateNotifier({ pkg }).notify()
  }

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
      await new CreateTemplate({ ...options, signal }).run(projectName)
    })

  program.showHelpAfterError()
  await program.parseAsync(process.argv)
}

/**
 * 判断当前命令是否需要加载更新检查依赖
 *
 * @remarks
 * 帮助和版本查询是本地只读快路径，不应为网络更新提示增加启动成本
 *
 * @param argv - Node 进程参数
 * @returns 普通创建命令返回 `true`
 * @internal
 */
function shouldCheckForUpdates(argv: readonly string[]): boolean {
  return !argv.some(argument =>
    ['-h', '--help', '-v', '--version'].includes(argument),
  )
}
