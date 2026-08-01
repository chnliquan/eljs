import debug, { type Debugger } from 'debug'

/**
 * 调试选项
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

type NodeDebugger = Debugger & {
  inspectOpts?: {
    depth?: boolean | number | null
  }
}

/**
 * 创建调试器
 * @param namespace - 命名空间
 * @param options - 选项
 */
export function createDebugger(
  namespace: string,
  options: DebuggerOptions = {},
): Debugger['log'] | undefined {
  const log = debug(namespace) as NodeDebugger
  const { onlyWhenFocused, depth } = options
  const inspectOpts = log.inspectOpts

  if (depth !== undefined && inspectOpts && inspectOpts.depth == null) {
    inspectOpts.depth = depth
  }

  let enabled = log.enabled

  if (enabled && onlyWhenFocused) {
    const ns = typeof onlyWhenFocused === 'string' ? onlyWhenFocused : namespace
    // 动态读取环境变量而不是使用模块顶部的常量
    enabled = !!process.env.DEBUG?.includes(ns)
  }

  if (enabled) {
    return (formatter: unknown, ...args: unknown[]) => {
      log(formatter, ...args)
    }
  }
}
