/* eslint-disable @typescript-eslint/no-explicit-any */
import cp from 'child_process'
import execa, { command } from 'execa'
import read from 'read'

import { isObject } from '.'
import { getExecutableCmd } from './file'

export function run(file: string): execa.ExecaChildProcess
export function run(file: string, args: string[]): execa.ExecaChildProcess
export function run(file: string, opts: execa.Options): execa.ExecaChildProcess
export function run(
  file: string,
  args: string[],
  opts: execa.Options,
): execa.ExecaChildProcess
export function run(
  file: string,
  args: any = [],
  opts: execa.Options = Object.create(null),
): execa.ExecaChildProcess {
  if (isObject(args)) {
    opts = args
    args = []
  }

  return execa(file, args, {
    stdio: 'inherit',
    ...opts,
  })
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
    command('ps -eo pid,comm')
      .then(value => {
        const pid = parse(value.stdout, cmd)
        resolve(pid)
      })
      .catch(reject)
  })
}

export interface SudoOptions {
  spawnOpts?: cp.SpawnOptions
  password?: string
  cachePassword?: boolean
  prompt?: string
}

let cachedPassword: string

export function sudo(args: string[], opts?: SudoOptions): void {
  const NEED_PASSWORD = '#node-sudo-passwd#'
  const {
    spawnOpts = {},
    password,
    cachePassword,
    prompt = 'sudo requires your password',
  } = opts || {}
  const bin = getExecutableCmd('sudo') as string

  args = ['-S', '-p', NEED_PASSWORD].concat(args)
  spawnOpts.stdio = 'pipe'

  const child = cp.spawn(bin, args, spawnOpts)

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
          if (child.stdin) {
            if (password) {
              child.stdin.write(password + '\n')
            } else if (cachePassword && cachedPassword) {
              child.stdin.write(cachedPassword + '\n')
            } else {
              read({ prompt, silent: true }, (err, answer) => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                child.stdin!.write(answer + '\n')

                if (cachePassword) {
                  cachedPassword = answer
                }
              })
            }
          }
        } else {
          console.log(line)
        }
      })
    })
  }
}
