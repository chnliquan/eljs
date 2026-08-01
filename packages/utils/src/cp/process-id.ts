import path from 'node:path'

import { runCommandLine } from './command'

/**
 * 查找命令对应的进程 ID
 * @param command - 命令名称或可执行文件路径
 * @returns 首个匹配进程的 ID，未找到时返回 `null`
 * @throws 系统进程查询命令执行失败时抛出错误
 */
export async function findProcessId(command: string): Promise<number | null> {
  if (process.platform === 'win32') {
    const result = await runCommandLine('tasklist /FO CSV /NH')
    return parseWindowsTaskList(result.stdout, command)
  }

  const result = await runCommandLine('ps -eo pid,comm')
  const expected = path.basename(command)

  for (const line of result.stdout.trim().split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/, 2)

    if (fields.length !== 2) {
      continue
    }

    const [pid, commandName] = fields

    if (path.basename(commandName) === expected) {
      return Number.parseInt(pid, 10)
    }
  }

  return null
}

/**
 * 查找命令对应的进程 ID
 * @param command - 命令名称或可执行文件路径
 * @returns 首个匹配进程的 ID，未找到时返回 `null`
 * @deprecated 请改用 {@link findProcessId}
 */
export function getPid(command: string): Promise<number | null> {
  return findProcessId(command)
}

/**
 * 解析 Windows `tasklist` 的 CSV 输出
 * @param data - `tasklist` 标准输出
 * @param command - 要匹配的命令名称或路径
 * @returns 首个匹配进程的 ID，未找到时返回 `null`
 * @internal
 */
function parseWindowsTaskList(data: string, command: string): number | null {
  const expected = path.win32.basename(command).toLowerCase()
  const expectedWithExtension = expected.endsWith('.exe')
    ? expected
    : `${expected}.exe`

  for (const line of data.trim().split(/\r?\n/)) {
    const match = /^"((?:[^"]|"")*)","(\d+)"/.exec(line.trim())

    if (!match) {
      continue
    }

    const imageName = match[1].replace(/""/g, '"').toLowerCase()

    if (imageName === expected || imageName === expectedWithExtension) {
      return Number.parseInt(match[2], 10)
    }
  }

  return null
}
