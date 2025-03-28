import { isPathExists, isPathExistsSync } from '@/file'
import { EOL } from 'node:os'
import path from 'node:path'

/**
 * 获取存在的路径
 * @param paths 路径数组
 */
export async function tryPaths(paths: string[]): Promise<string | undefined> {
  for await (const path of paths) {
    if (await isPathExists(path)) {
      return path
    }
  }
}

/**
 * 获取存在的路径
 * @param paths 路径数组
 */
export function tryPathsSync(paths: string[]): string | undefined {
  for (const path of paths) {
    if (isPathExistsSync(path)) {
      return path
    }
  }
}

/**
 * 提取代码执行时的文件夹
 * @param stack 栈深度
 */
export function extractCallDir(stack = 2): string {
  const obj = Object.create(null)
  Error.captureStackTrace(obj)
  const callSite = obj.stack.split(EOL)[stack]

  // the regexp for the stack when called inside a named function
  const namedStackRegExp = /\s\((.*):\d+:\d+\)$/
  // the regexp for the stack when called inside an anonymous
  const anonymousStackRegExp = /at (.*):\d+:\d+$/

  let matchResult = callSite.match(namedStackRegExp)

  if (!matchResult) {
    matchResult = callSite.match(anonymousStackRegExp)
  }

  const fileName = matchResult[1]
  return path.dirname(fileName)
}
