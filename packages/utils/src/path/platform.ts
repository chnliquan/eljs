/**
 * 解析 windows 系统地址
 * @param path 路径地址
 */
export function winPath(path: string): string {
  const isExtendedLengthPath = /^\\\\\?\\/.test(path)

  if (isExtendedLengthPath) {
    return path
  }

  return path.replace(/\\/g, '/')
}
