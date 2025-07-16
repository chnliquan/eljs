import cp from 'node:child_process'
import { EOL } from 'node:os'
import { read } from 'read'

import { isObject } from '@/type'
import { getExecutableCommand, runCommand } from './command'

/**
 * 获取命令对应的进程 ID
 * @param command 命令名称
 */
export function getPid(command: string): Promise<number | null> {
  const parse = (data: string, command: string): number | null => {
    const reg = new RegExp('/' + command + '$')
    const lines = data.trim().split(EOL)

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
 * @param options 选项
 */
export async function sudo(options?: SudoOptions): Promise<void>
/**
 * 以 sudo 模式执行命令
 * @param args 命令参数
 * @param options 选项
 */
export async function sudo(args: string[], options?: SudoOptions): Promise<void>
export async function sudo(
  args?: string[] | SudoOptions,
  options?: SudoOptions,
): Promise<void> {
  if (isObject(args)) {
    options = args
    args = []
  }

  const NEED_PASSWORD = '#node-sudo-passwd#'
  const {
    spawnOptions = {},
    password,
    cachePassword,
    prompt = 'sudo requires your password',
  } = options || {}
  const bin = (await getExecutableCommand('sudo')) as string

  args = ['-S', '-p', NEED_PASSWORD, ...(args ? (args as string[]) : [])]
  spawnOptions.stdio = 'pipe'

  const child = cp.spawn(bin, args, spawnOptions)

  if (child.stdout) {
    child.stdout.on('data', chunk => {
      console.log(chunk.toString().trim())
    })
  }

  if (child.stderr) {
    child.stderr.on('data', chunk => {
      const lines = chunk.toString().trim().split(EOL)

      lines.forEach((line: string) => {
        if (line === NEED_PASSWORD) {
          if (password) {
            child.stdin?.write(password + EOL)
          } else if (cachePassword && cachedPassword) {
            child.stdin?.write(cachedPassword + EOL)
          } else {
            read({ prompt, silent: true }).then(value => {
              child.stdin?.write(value + EOL)

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
