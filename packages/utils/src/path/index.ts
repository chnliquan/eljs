import path from 'path'

import { isPathExistsSync } from '../file'

/**
 * 解析 windows 系统地址
 * @param path 路径地址
 */
export function winPath(path: string) {
  const isExtendedLengthPath = /^\\\\\?\\/.test(path)

  if (isExtendedLengthPath) {
    return path
  }

  return path.replace(/\\/g, '/')
}

/**
 * 获取存在的路径
 * @param paths 路径数组
 */
export function tryPaths(paths: string[]) {
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
export function extractCallDir(stack = 2) {
  const obj = Object.create(null)
  Error.captureStackTrace(obj)
  const callSite = obj.stack.split('\n')[stack]

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
