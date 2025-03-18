import debug, { type Debugger } from 'debug'

const DEBUG = process.env.DEBUG

/**
 * 调试配置项
 */
interface DebuggerOptions {
  /**
   * 仅当包含当前字符串时开启
   */
  onlyWhenFocused?: boolean | string
  /**
   * 对象检查深度
   */
  depth?: number
}

/**
 * 创建调试器
 * @param namespace 命名空间
 * @param options 可选配置项
 */
export function createDebugger(
  namespace: string,
  options: DebuggerOptions = {},
): Debugger['log'] | undefined {
  const log = debug(namespace)
  const { onlyWhenFocused, depth } = options

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (depth && log.inspectOpts && log.inspectOpts.depth == null) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    log.inspectOpts.depth = options.depth
  }

  let enabled = log.enabled

  if (enabled && onlyWhenFocused) {
    const ns = typeof onlyWhenFocused === 'string' ? onlyWhenFocused : namespace
    enabled = !!DEBUG?.includes(ns)
  }

  if (enabled) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (...args: [string, ...any[]]) => {
      log(...args)
    }
  }
}
