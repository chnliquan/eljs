/**
 * 解析 windows 系统路径
 * @param path 文件路径
 */
export function winPath(path: string): string {
  const isExtendedLengthPath = /^\\\\\?\\/.test(path)

  if (isExtendedLengthPath) {
    return path
  }

  return path.replace(/\\/g, '/')
}
