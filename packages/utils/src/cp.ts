import chalk from 'chalk'
import cp from 'child_process'
import execa from 'execa'
import read from 'read'

import { getExecutableCmd } from './file'

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

export function run(
  command: string,
  opts?: execa.Options & {
    verbose?: boolean
  },
): execa.ExecaChildProcess {
  if (opts?.verbose !== false) {
    const [cmd, ...args] = parseCommand(command)
    console.log('$', chalk.greenBright(cmd), ...args)
  }

  return execa.command(command, opts)
}

const targetVersion = '0.2.2'
run(`git commit --message chore:\\ bump\\ version\\ v${targetVersion}`, {
  verbose: false,
})

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
    run('ps -eo pid,comm')
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
