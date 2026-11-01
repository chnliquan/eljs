import { spawnSync } from 'node:child_process'

/**
 * 打包校验中单条命令的宽松时间上限，避免本地验证无限等待
 */
const COMMAND_TIMEOUT_MS = 5 * 60 * 1000

/**
 * 执行打包校验命令，捕获输出并在失败或超时时终止当前校验
 *
 * @remarks
 * 仅供打包校验使用，不用于可能已经上传产物的真实发布命令
 * 超时强制终止直接子进程，避免其忽略 SIGTERM 后继续阻塞同步等待
 * 调用方负责清理校验临时目录，本函数不重试或管理后代进程
 *
 * @param command - 校验可执行文件
 * @param args - 不经过 shell 解释的独立参数
 * @param options - 命令目录及内部超时覆盖，默认每条命令五分钟
 * @returns 去除首尾空白的标准输出
 * @throws 启动失败、非零退出或超时时抛出包含命令定位信息的错误
 * @internal
 */
export function runPackageCheckCommand(
  command: string,
  args: string[],
  options: { cwd: string; timeout?: number },
): string {
  const timeout = options.timeout ?? COMMAND_TIMEOUT_MS
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    timeout,
    killSignal: 'SIGKILL',
    env: {
      ...process.env,
      CI: 'true',
      NO_UPDATE_NOTIFIER: '1',
    },
  })
  const commandText = `${command} ${args.join(' ')}`
  const error = result.error as NodeJS.ErrnoException | undefined
  if (error?.code === 'ETIMEDOUT') {
    throw new Error(
      `Package verification command timed out after ${timeout} ms: ${commandText}`,
    )
  }
  if (error) {
    throw new Error(
      `${commandText} could not run (${error.code ?? error.message}).`,
    )
  }
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n')
    throw new Error(
      `${commandText} failed with exit code ${result.status}.\n${output}`,
    )
  }
  return result.stdout.trim()
}
