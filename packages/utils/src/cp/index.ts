import chalk from 'chalk'
import cp from 'child_process'
import execa from 'execa'
import path from 'path'
import read from 'read'

import { isPathExistsSync } from '../file'

const SPACES_REGEXP = / +/g

export function parseCommand(command: string) {
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
 * 执行命令
 * @param cmd 可执行命令
 * @param args 命令可传入的参数
 * @param options 选项
 */
export function run(
  cmd: string,
  args: readonly string[],
  options?: execa.Options & {
    verbose?: boolean
  },
): execa.ExecaChildProcess {
  if (options?.verbose !== false) {
    console.log('$', chalk.greenBright(cmd), ...args)
  }

  return execa(cmd, args, options)
}

/**
 * 执行命令
 * @param command 命令字符串
 * @param options 选项
 */
export function runCommand(
  command: string,
  options?: execa.Options & {
    verbose?: boolean
  },
): execa.ExecaChildProcess {
  const [cmd, ...args] = parseCommand(command)
  return run(cmd, args, options)
}

export function getPid(cmd: string): Promise<number | null> {
  const parse = (data: string, cmd: string): number | null => {
    const reg = new RegExp('/' + cmd + '$')
    const lines = data.trim().split('\n')

    for (const line of lines) {
      const fields = line.trim().split(/\s+/, 2)

      if (fields.length !== 2) {
        continue
      }

      const [pid, cmdName] = fields

      if (cmdName === cmd || reg.test(cmdName)) {
        return parseInt(pid, 10)
      }
    }

    return null
  }

  return new Promise((resolve, reject) => {
    runCommand('ps -eo pid,comm')
      .then(value => {
        const pid = parse(value.stdout, cmd)
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

export function sudo(args: string[], options?: SudoOptions): void {
  const NEED_PASSWORD = '#node-sudo-passwd#'
  const {
    spawnOptions = {},
    password,
    cachePassword,
    prompt = 'sudo requires your password',
  } = options || {}
  const bin = getExecutableCmd('sudo') as string

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
            read({ prompt, silent: true }, (err, answer) => {
              child.stdin?.write(answer + '\n')

              if (cachePassword) {
                cachedPassword = answer
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

export function getExecutableCmd(
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
