import { isArray } from '../guards'
import { parseCommandLine } from './command-line'

/**
 * 格式化参数
 * @param args - 参数
 */
export function normalizeArgs(args?: string | string[]): string[] {
  if (!args) {
    return []
  }

  if (isArray(args)) {
    return args
  }

  return parseCommandLine(args)
}
