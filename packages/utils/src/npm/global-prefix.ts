import path from 'node:path'
import which from 'which'

import { PLATFORM } from '../constants'
import { run } from '../cp'

/**
 * 获取 npm 全局安装前缀
 * @returns 当前进程缓存或运行环境推断出的全局安装前缀
 */
export async function getNpmPrefix(): Promise<string> {
  if (process.env.GLOBAL_PREFIX) {
    return process.env.GLOBAL_PREFIX
  }

  let prefix = 'usr/local'

  if (process.platform === PLATFORM.WIN) {
    try {
      prefix = (await run('npm', ['prefix', '-g'])).stdout.toString().trim()
    } catch {
      // npm 不可用时保留跨平台默认值
    }
  } else {
    try {
      prefix = path.join(await which('node'), '../../')
    } catch {
      // Node.js 可执行文件无法定位时保留跨平台默认值
    }
  }

  process.env.GLOBAL_PREFIX = prefix
  return prefix
}
