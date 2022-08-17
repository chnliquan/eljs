import cp from 'child_process'

export interface Output {
  stdout: string
  stderr: string
}

export function exec(
  cmd: string,
  options?: cp.ExecOptions,
  output?: Output,
): Promise<string> {
  const opts = options || {}
  const op = output || ({} as Output)

  if (!opts.maxBuffer) {
    opts.maxBuffer = 2 * 1024 * 1024
  }

  return new Promise((resolve, reject) => {
    cp.exec(cmd, opts, (err, stdout, stderr) => {
      if (err) {
        reject(err)
      } else {
        op.stdout = stdout.toString()
        op.stderr = stderr.toString()
        resolve(stdout.toString())
      }
    })
  })
}

export function spawn(
  cmd: string,
  args: string[],
  opts: cp.SpawnOptions,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = cp.spawn(cmd, args, opts)

    // child 出现 error 事件时, exit 可能会触发, 也可能不会
    let hasError = false

    child.once('error', err => {
      hasError = true
      reject(err)
    })

    child.once('exit', code => {
      if (hasError) {
        return
      }

      if (code) {
        reject(new Error(`Failed Spawn Command ${cmd}, errorCode is ${code}`))
      } else {
        resolve()
      }
    })
  })
}
