import readline from 'node:readline'

/**
 * 暂定输入
 * @param msg 展示信息
 */
export function pause(msg?: string): Promise<void> {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    if (!msg) {
      msg = 'Press Enter key to continue...'
    }

    rl.question(msg, () => {
      resolve()
      rl.close()
    })
  })
}
