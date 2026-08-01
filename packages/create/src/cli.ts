import { readJson } from '@eljs/utils/file'
import { createDebugger, logger } from '@eljs/utils/logger'
import type { PackageJson } from '@eljs/utils/types'
import { program } from 'commander'
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
  const controller = new AbortController()
  const disposeSignalHandlers = registerSignalHandlers(controller)

  return main(controller.signal)
    .then(() => {
      if (controller.signal.aborted) {
        throw controller.signal.reason
      }
    })
    .catch(error => {
      if (isCancellation(error) || controller.signal.aborted) {
        process.exitCode = 130
      } else if (error instanceof AppError) {
        logger.error(error.message)
        process.exitCode = 1
      } else {
        console.error(error)
        process.exitCode = 1
      }
    })
    .finally(disposeSignalHandlers)
}

function registerSignalHandlers(controller: AbortController): () => void {
  const handleSignal = (signal: NodeJS.Signals) => {
    if (!controller.signal.aborted) {
      logger.event(`Cancelling create after ${signal}`)
      controller.abort(
        new AppError(`Create operation received ${signal}`, {
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
  const debug = createDebugger('create:cli')
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
        signal,
        template,
      }).run(projectName)
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
