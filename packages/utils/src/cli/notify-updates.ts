/** 跳过更新检查的本地只读参数 */
const READ_ONLY_ARGUMENTS = ['-h', '--help', '-v', '--version'] as const

/**
 * 后台更新提示的参数
 */
export interface NotifyUpdatesOptions {
  /**
   * 当前 CLI 包的 package.json 内容
   */
  pkg: { name: string; version: string }
  /**
   * Node 进程参数，用于跳过只读快路径
   */
  argv: readonly string[]
  /**
   * 调试日志函数，更新检查失败时记录原因
   */
  debug?: (...args: unknown[]) => void
}

/**
 * 后台触发 CLI 更新提示
 *
 * @remarks
 * 帮助和版本查询跳过网络请求以降低启动成本
 *
 * @param options - 更新提示参数
 */
export function notifyUpdates(options: NotifyUpdatesOptions): void {
  const { pkg, argv, debug } = options

  if (shouldCheckForUpdates(argv)) {
    // 更新提示是辅助能力，加载或检查失败不能阻止 CLI 主路径
    void import('update-notifier')
      .then(({ default: updateNotifier }) => {
        updateNotifier({ pkg }).notify()
      })
      .catch(error => {
        debug?.('update notification failed:%O', error)
      })
  }
}

/**
 * 判断当前命令是否需要检查更新
 *
 * @param argv - Node 进程参数
 * @returns 普通命令返回 `true`
 * @internal
 */
function shouldCheckForUpdates(argv: readonly string[]): boolean {
  return !argv.some(argument =>
    (READ_ONLY_ARGUMENTS as readonly string[]).includes(argument),
  )
}
