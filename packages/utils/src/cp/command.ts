import chalk from 'chalk'
import { execa, type Options as ExecaOptions, type ResultPromise } from 'execa'
import path from 'node:path'
import which from 'which'

import type { UtilsRuntime } from '../observability'
import { emitUtilsEvent, emitUtilsLog } from '../observability/internal'
import { parseCommandLine } from './command-line'

/**
 * 运行命令选项
 */
export type RunCommandOptions = Omit<
  ExecaOptions,
  'cancelSignal' | 'cwd' | 'verbose'
> & {
  /**
   * 子进程工作目录
   */
  cwd?: string

  /**
   * 当前运行环境使用的日志与监控适配器
   */
  runtime?: UtilsRuntime

  /**
   * 用于终止子进程的取消信号
   */
  signal?: AbortSignal

  /**
   * 是否打印命令
   */
  verbose?: boolean
}

type TextResultOptions = { readonly encoding?: 'utf8' }

/**
 * 运行命令子进程
 */
export type RunCommandChildProcess = ResultPromise<TextResultOptions>

/**
 * 运行命令
 * @param command - 命令名称
 * @param options - 选项
 */
export function run(
  command: string,
  options?: RunCommandOptions,
): RunCommandChildProcess
/**
 * 运行命令
 * @param command - 命令名称
 * @param args - 命令行参数
 * @param options - 选项
 */
export function run(
  command: string,
  args: string[],
  options?: RunCommandOptions,
): RunCommandChildProcess
export function run(
  command: string,
  args?: string[] | RunCommandOptions,
  options?: RunCommandOptions,
): RunCommandChildProcess {
  if (args && !Array.isArray(args)) {
    options = args
    args = []
  }

  args = (args || []) as string[]
  const runtime = options?.runtime
  const startedAt = Date.now()
  let execaOptions: ExecaOptions | undefined

  if (options) {
    const {
      runtime: _runtime,
      signal: _signal,
      verbose: _verbose,
      ...rest
    } = options
    execaOptions = rest as ExecaOptions
  }

  if (options?.verbose) {
    if (runtime?.logger) {
      emitUtilsLog(runtime, {
        level: 'info',
        message: `$ ${command} ${args.join(' ')}`.trim(),
        operation: 'cp.run',
      })
    } else {
      console.log('$', chalk.greenBright(command), ...args)
    }
  }

  emitUtilsEvent(runtime, {
    attributes: { argumentCount: args.length, command },
    operation: 'cp.run',
    phase: 'start',
    timestamp: startedAt,
  })

  const child = execa(command, args, execaOptions) as RunCommandChildProcess
  const abortChild = () => child.kill('SIGTERM')
  options?.signal?.addEventListener('abort', abortChild, { once: true })

  if (options?.signal?.aborted) {
    abortChild()
  }

  const cleanupSignal = () => {
    options?.signal?.removeEventListener('abort', abortChild)
  }

  void Promise.resolve(child).then(
    () => {
      cleanupSignal()
      emitUtilsEvent(runtime, {
        attributes: { argumentCount: args.length, command },
        durationMs: Date.now() - startedAt,
        operation: 'cp.run',
        phase: 'success',
        timestamp: Date.now(),
      })
    },
    error => {
      cleanupSignal()
      emitUtilsEvent(runtime, {
        attributes: { argumentCount: args.length, command },
        durationMs: Date.now() - startedAt,
        error,
        operation: 'cp.run',
        phase: 'failure',
        timestamp: Date.now(),
      })
    },
  )

  return child
}

/**
 * 解析并运行不经过 shell 的命令行文本
 * @param command - 命令行文本
 * @param options - 选项
 * @returns 子进程句柄
 * @deprecated 请改用 {@link runCommandLine}
 */
export function runCommand(
  command: string,
  options?: RunCommandOptions,
): RunCommandChildProcess {
  return runCommandLine(command, options)
}

/**
 * 解析并运行不经过 shell 的命令行文本
 * @param commandLine - 命令行文本
 * @param options - 选项
 * @returns 子进程句柄
 * @throws 当命令行为空或仅包含空白字符时抛出 `TypeError`
 */
export function runCommandLine(
  commandLine: string,
  options?: RunCommandOptions,
): RunCommandChildProcess {
  const [cmd, ...args] = parseCommandLine(commandLine)

  if (!cmd) {
    throw new TypeError('Command line must not be empty')
  }

  return run(cmd, args, options)
}

/**
 * 查找可执行文件
 * @param target - 命令
 * @param dirs - 文件夹
 * @returns 可执行文件绝对路径，未找到时返回 `null`
 */
export async function findExecutable(
  target: string,
  dirs?: string[],
): Promise<string | null> {
  return which(target, {
    ...(dirs ? { path: dirs.join(path.delimiter) } : {}),
    nothrow: true,
  })
}

/**
 * 查找可执行文件
 * @param target - 命令
 * @param dirs - 文件夹
 * @returns 可执行文件绝对路径，未找到时返回 `null`
 * @deprecated 请改用 {@link findExecutable}
 */
export function getExecutableCommand(
  target: string,
  dirs?: string[],
): Promise<string | null> {
  return findExecutable(target, dirs)
}
