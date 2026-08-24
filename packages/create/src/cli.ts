import { readJson } from '@eljs/utils/file'
import { createDebugger, logger } from '@eljs/utils/logger'
import type { PackageJson } from '@eljs/utils/types'
import { Command } from 'commander'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ProjectCreator } from './core'
import { AppError } from './utils'

/** 首次终止信号后等待异步清理完成的最长时间 */
const FORCE_EXIT_GRACE_PERIOD_MS = 5_000

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
        process.exitCode = 1
        try {
          logger.error(error.message)
        } catch {
          // 日志是辅助能力，领域错误仍需保持稳定退出语义
        }
      } else {
        process.exitCode = 1
        try {
          console.error(error)
        } catch {
          // 控制台异常不能让 CLI 错误处理再次失败
        }
      }
    })
    .finally(disposeSignalHandlers)
}

/**
 * 注册 CLI 进程信号并返回对称的清理函数
 *
 * @param controller - 当前创建流程的取消控制器
 * @returns 移除本次注册信号监听器的函数
 * @internal
 */
function registerSignalHandlers(controller: AbortController): () => void {
  let forceExitTimer: NodeJS.Timeout | undefined

  const handleSignal = (signal: NodeJS.Signals) => {
    if (!controller.signal.aborted) {
      try {
        logger.event(`Cancelling create after ${signal}`)
      } catch {
        // 日志失败不能阻止信号触发实际取消
      }
      // 即使后续只剩不持有事件循环句柄的悬空 Promise，自然退出也必须保留取消语义
      process.exitCode = 130
      controller.abort(
        new AppError(`Create operation received ${signal}`, {
          code: 'CREATE_OPERATION_CANCELLED',
          details: { signal },
        }),
      )
      // 第三方模版可能忽略 AbortSignal，宽限期后退出可避免进程无限挂起
      forceExitTimer = setTimeout(
        () => process.exit(130),
        FORCE_EXIT_GRACE_PERIOD_MS,
      )
      forceExitTimer.unref()
      return
    }

    process.exit(130)
  }

  process.on('SIGINT', handleSignal)
  process.on('SIGTERM', handleSignal)

  return () => {
    if (forceExitTimer) {
      clearTimeout(forceExitTimer)
    }
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
    .name('eljs-create')
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
