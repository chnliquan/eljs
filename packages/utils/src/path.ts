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
    if (existsSync(path)) return path
  }
}
