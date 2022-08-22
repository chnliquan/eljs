import path from 'path'
import { existsSync } from './file'

export function winPath(path: string) {
  const isExtendedLengthPath = /^\\\\\?\\/.test(path)

  if (isExtendedLengthPath) {
    return path
  }

  return path.replace(/\\/g, '/')
}

export function tryPaths(paths: string[]) {
  for (const path of paths) {
    if (existsSync(path)) {
      return path
    }
  }
}

export function extractCallDir() {
  const obj = Object.create(null)
  Error.captureStackTrace(obj)
  const callSite = obj.stack.split('\n')[2]

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
