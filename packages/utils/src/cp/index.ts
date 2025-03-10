import { isPathExistsSync } from '@/file'
import chalk from 'chalk'
import {
  execa,
  type ExecaChildProcess,
  type Options as ExecaOptions,
} from 'execa'
import cp from 'node:child_process'
import path from 'node:path'
import { read } from 'read'

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
 * 运行命令
 * @param command 可运行的命令
 * @param args 命令接收的参数
 * @param options 可选配置项
 */
export function run(
  command: string,
  args: string[],
  options?: ExecaOptions & {
    verbose?: boolean
  },
): ExecaChildProcess {
  if (options?.verbose !== false) {
    console.log('$', chalk.greenBright(command), ...args)
  }

  return execa(command, args, options)
}

/**
 * 运行命令
 * @param command 可运行的命令
 * @param options 可选配置项
 */
export function runCommand(
  command: string,
  options?: ExecaOptions & {
    verbose?: boolean
  },
): ExecaChildProcess {
  const [cmd, ...args] = parseCommand(command)
  return run(cmd, args, options)
}

/**
 * 获取命令对应的进程 ID
 * @param command 可运行的命令
 */
export function getPid(command: string): Promise<number | null> {
  const parse = (data: string, command: string): number | null => {
    const reg = new RegExp('/' + command + '$')
    const lines = data.trim().split('\n')

    for (const line of lines) {
      const fields = line.trim().split(/\s+/, 2)

      if (fields.length !== 2) {
        continue
      }

      const [pid, commandName] = fields

      if (commandName === command || reg.test(commandName)) {
        return parseInt(pid, 10)
      }
    }

    return null
  }

  return new Promise((resolve, reject) => {
    runCommand('ps -eo pid,comm')
      .then(value => {
        const pid = parse(value.stdout, command)
        resolve(pid)
      })
      .catch(reject)
  })
}

export interface SudoOptions {
  spawnOptions?: cp.SpawnOptions
  password?: string
  cachePassword?: boolean
  prompt?: string
}

let cachedPassword: string

/**
 * 以 sudo 模式执行命令
 * @param args 命令参数
 * @param options 可选配置项
 */
export async function sudo(
  args: string[],
  options: SudoOptions = {},
): Promise<void> {
  const NEED_PASSWORD = '#node-sudo-passwd#'
  const {
    spawnOptions = {},
    password,
    cachePassword,
    prompt = 'sudo requires your password',
  } = options
  const bin = getExecutableCommand('sudo') as string

  args = ['-S', '-p', NEED_PASSWORD].concat(args)
  spawnOptions.stdio = 'pipe'

  const child = cp.spawn(bin, args, spawnOptions)

  if (child.stdout) {
    child.stdout.on('data', chunk => {
      console.log(chunk.toString().trim())
    })
  }

  if (child.stderr) {
    child.stderr.on('data', chunk => {
      const lines = chunk.toString().trim().split('\n')

      lines.forEach((line: string) => {
        if (line === NEED_PASSWORD) {
          if (password) {
            child.stdin?.write(password + '\n')
          } else if (cachePassword && cachedPassword) {
            child.stdin?.write(cachedPassword + '\n')
          } else {
            read({ prompt, silent: true }).then(value => {
              child.stdin?.write(value + '\n')

              if (cachePassword) {
                cachedPassword = value
              }
            })
          }
        } else {
          console.log(line)
        }
      })
    })
  }
}

/**
 * 获取可执行的命令
 * @param target 命令
 * @param dirs 文件夹
 */
export function getExecutableCommand(
  target: string,
  dirs?: string[],
): string | null {
  if (!dirs) {
    dirs = (process.env.PATH || '').split(':')
  }

  for (const dir of dirs) {
    const p = path.join(dir, target)

    if (isPathExistsSync(p)) {
      return p
    }
  }

  return null
}
