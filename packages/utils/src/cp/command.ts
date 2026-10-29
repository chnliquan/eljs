import chalk from 'chalk'
import { execa, type Options as ExecaOptions, type ResultPromise } from 'execa'
import path from 'node:path'
import type { Readable, Writable } from 'node:stream'
import which from 'which'

import { parseCommandLine } from './command-line'

/**
 * 运行命令选项
 * @remarks 使用 `signal` 取消子进程，其余选项透传给 execa
 */
export type RunCommandOptions = Omit<
  ExecaOptions,
  'cancelSignal' | 'cwd' | 'verbose'
> & {
  /** 子进程工作目录 */
  cwd?: string
  /** 用于终止子进程的取消信号 */
  signal?: AbortSignal
  /** 是否打印命令 */
  verbose?: boolean
}

/**
 * 将工具层命令选项还原为 execa 选项，同时保留联合类型的各分支
 */
type ExecaCommandOptions<Options extends RunCommandOptions> =
  Options extends unknown
    ? Omit<Options, 'signal' | 'verbose'> extends ExecaOptions
      ? Omit<Options, 'signal' | 'verbose'>
      : ExecaOptions & Omit<Options, 'signal' | 'verbose'>
    : never

/** 动态命令选项可能产生的输出，包括文本、二进制、按行或对象模式结果 */
type DynamicCommandOutput = string | Uint8Array | unknown[] | undefined

/**
 * 动态 stdio 的完成结果，避免 execa 将不确定的输出流过窄推导为输入流
 */
type DynamicCommandResult = Omit<
  Awaited<ResultPromise>,
  'stdout' | 'stderr' | 'all' | 'stdio'
> & {
  stdout: DynamicCommandOutput
  stderr: DynamicCommandOutput
  all: DynamicCommandOutput
  stdio: [
    undefined,
    DynamicCommandOutput,
    DynamicCommandOutput,
    ...DynamicCommandOutput[],
  ]
}

/**
 * 动态 stdio 子进程与完成 Promise，保留流存在与否及输出类型的不确定性
 */
type DynamicCommandChildProcess = Omit<
  ResultPromise,
  keyof Promise<unknown> | 'stdin' | 'stdout' | 'stderr' | 'all' | 'stdio'
> &
  Promise<DynamicCommandResult> & {
    stdin: Writable | null
    stdout: Readable | null
    stderr: Readable | null
    all: Readable | undefined
    stdio: [
      Writable | null,
      Readable | null,
      Readable | null,
      ...Array<Readable | Writable | null>,
    ]
  }

/**
 * 运行命令子进程
 * @typeParam Options - 命令选项，决定编码、按行输出及标准流等返回类型
 * @remarks 未指定选项时返回文本结果；动态 stdio 选项保留默认管道与配置流的可能结果
 */
export type RunCommandChildProcess<Options extends RunCommandOptions = {}> =
  'stdio' extends keyof Options
    ? undefined extends Options['stdio']
      ? DynamicCommandChildProcess
      : ResultPromise<ExecaCommandOptions<Options>>
    : ResultPromise<ExecaCommandOptions<Options>>

/**
 * 运行命令
 * @typeParam Options - 用于推导子进程和完成结果类型的命令选项
 * @param command - 命令名称
 * @param options - 选项
 * @returns 保留 execa 选项对应类型的子进程句柄及完成 Promise
 */
export function run<const Options extends RunCommandOptions = {}>(
  command: string,
  options?: Options,
): RunCommandChildProcess<Options>
/**
 * 运行命令
 * @typeParam Options - 用于推导子进程和完成结果类型的命令选项
 * @param command - 命令名称
 * @param args - 命令行参数
 * @param options - 选项
 * @returns 保留 execa 选项对应类型的子进程句柄及完成 Promise
 */
export function run<const Options extends RunCommandOptions = {}>(
  command: string,
  args: string[],
  options?: Options,
): RunCommandChildProcess<Options>
export function run<const Options extends RunCommandOptions = {}>(
  command: string,
  args?: string[] | Options,
  options?: Options,
): RunCommandChildProcess<Options> {
  if (args && !Array.isArray(args)) {
    options = args
    args = []
  }

  args = (args || []) as string[]
  let execaOptions: ExecaOptions | undefined

  if (options) {
    const { signal, verbose: _verbose, ...rest } = options
    execaOptions = {
      ...rest,
      ...(signal ? { cancelSignal: signal } : {}),
    } as ExecaOptions
  }

  if (options?.verbose) {
    console.log('$', chalk.greenBright(command), ...args)
  }

  return execa(
    command,
    args,
    execaOptions,
  ) as unknown as RunCommandChildProcess<Options>
}

/**
 * 解析并运行不经过 shell 的命令行文本
 * @typeParam Options - 用于推导子进程和完成结果类型的命令选项
 * @param commandLine - 命令行文本
 * @param options - 选项
 * @returns 子进程句柄
 * @throws 当命令行为空或仅包含空白字符时抛出 `TypeError`
 */
export function runCommandLine<const Options extends RunCommandOptions = {}>(
  commandLine: string,
  options?: Options,
): RunCommandChildProcess<Options> {
  const [cmd, ...args] = parseCommandLine(commandLine)

  if (!cmd) {
    throw new TypeError('Command line must not be empty')
  }

  return run(cmd, args, options)
}

/**
 * 校验供 Git 和 npm 查询解析的命令输出，避免将二进制或按行结果当作文本使用
 * @param output - 已完成命令的标准输出
 * @returns 文本输出
 * @throws 输出不是字符串时抛出 `TypeError`
 * @internal
 */
export function getCommandTextOutput(output: unknown): string {
  if (typeof output !== 'string') {
    throw new TypeError('Command output must be text to be parsed')
  }

  return output
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
