import chalk from 'chalk'
import execa, {
  type ExecaChildProcess,
  type Options as ExecaOptions,
} from 'execa'
import path from 'node:path'

import { isPathExists } from '../file'
import { isObject } from '../type'

const SPACES_REGEXP = / +/g

/**
 * 解析命令
 * @param command 可执行的命令
 */
export function parseCommand(command: string): string[] {
  const tokens: string[] = []

  for (const token of command.trim().split(SPACES_REGEXP)) {
    // Allow spaces to be escaped by a backslash if not meant as a delimiter
    const previousToken: string = tokens[tokens.length - 1]

    if (previousToken && previousToken.endsWith('\\')) {
      // Merge previous token with current one
      tokens[tokens.length - 1] = `${previousToken.slice(0, -1)} ${token}`
    } else {
      tokens.push(token)
    }
  }

  return tokens
}

/**
 * 运行命令选项
 */
export interface RunCommandOptions extends ExecaOptions {
  /**
   * 是否打印命令
   */
  verbose?: boolean
}

/**
 * 运行命令子进程
 */
export type RunCommandChildProcess = ExecaChildProcess

/**
 * 运行命令
 * @param command 命令名称
 * @param options 选项
 */
export function run(
  command: string,
  options?: RunCommandOptions,
): RunCommandChildProcess
/**
 * 运行命令
 * @param command 命令名称
 * @param args 命令行参数
 * @param options 选项
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
  if (isObject(args)) {
    options = args
    args = []
  }

  args = (args || []) as string[]

  if (options?.verbose) {
    console.log('$', chalk.greenBright(command), ...args)
  }

  return execa(command, args, options)
}

/**
 * 运行命令
 * @param command 命令名称
 * @param options 选项
 */
export function runCommand(
  command: string,
  options?: RunCommandOptions,
): RunCommandChildProcess {
  const [cmd, ...args] = parseCommand(command)
  return run(cmd, args, options)
}

/**
 * 获取可执行的命令
 * @param target 命令
 * @param dirs 文件夹
 */
export async function getExecutableCommand(
  target: string,
  dirs?: string[],
): Promise<string | null> {
  if (!dirs) {
    dirs = (process.env.PATH || '').split(':')
  }

  for (const dir of dirs) {
    const resolved = path.join(dir, target)

    if (await isPathExists(resolved)) {
      return resolved
    }
  }

  return null
}
