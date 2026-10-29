import readline from 'node:readline'

/**
 * 暂停并等待用户输入一行
 * @param message - 展示信息
 * @returns 输入完成后兑现，并关闭本次创建的 readline 接口
 * @throws 输入完成前接口关闭或输入流出错时拒绝，并清理本次注册的监听器
 */
export function pause(message?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    let settled = false

    const finish = (error?: Error, closed = false) => {
      if (settled) return
      settled = true
      rl.off('close', onClose)
      rl.off('error', onError)
      if (!closed) rl.close()
      if (error) reject(error)
      else resolve()
    }
    const onClose = () => {
      finish(new Error('Input closed before pause received a line'), true)
    }
    const onError = (error: Error) => finish(error)

    rl.once('close', onClose)
    rl.once('error', onError)

    try {
      rl.question(message || 'Press Enter key to continue...', () => finish())
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)))
    }
  })
}
