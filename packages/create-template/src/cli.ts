import { AppError } from '@eljs/create/errors'
import { readJson } from '@eljs/utils/file'
import { createDebugger, logger } from '@eljs/utils/logger'
import type { PackageJson } from '@eljs/utils/types'
import { Command } from 'commander'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

/**
 * 注册 CLI 进程信号并返回对称的清理函数
 *
 * @param controller - 当前创建流程的取消控制器
 * @returns 移除本次注册信号监听器的函数
 * @internal
 */
function registerSignalHandlers(controller: AbortController): () => void {
  const handleSignal = (signal: NodeJS.Signals) => {
    if (!controller.signal.aborted) {
      try {
        logger.event(`Cancelling create template after ${signal}`)
      } catch {
        // 日志是辅助能力，不能阻止信号触发实际取消
      }
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

  const isLocalReadOnlyCommand = process.argv.some(argument =>
    ['-h', '--help', '-v', '--version'].includes(argument),
  )
  if (!isLocalReadOnlyCommand) {
    // 更新提示是辅助能力，加载或检查失败不能阻止创建主路径
    void import('update-notifier')
      .then(({ default: updateNotifier }) => {
        updateNotifier({ pkg }).notify()
      })
      .catch(error => {
        debug?.('update notification failed:%O', error)
      })
  }

  const command = new Command()
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
      const { CreateTemplate } = await import('./create')
      await new CreateTemplate({ ...options, signal }).run(projectName)
    })
    .showHelpAfterError()

  await command.parseAsync(process.argv)
}
