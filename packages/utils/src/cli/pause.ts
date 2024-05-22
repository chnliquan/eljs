import readline from 'readline'

/**
 * 暂定输入
 * @param message 展示信息
 */
export function pause(message?: string): Promise<void> {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    if (!message) {
      message = 'Press Enter key to continue...'
    }

    rl.question(message, () => {
      resolve()
      rl.close()
    })
  })
}
