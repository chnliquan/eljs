/**
 * 将常规路径转换为 POSIX 分隔符形式
 * @param path - 文件路径
 * @returns 使用 `/` 分隔的路径，Windows 扩展长度路径保持不变
 */
export function toPosixPath(path: string): string {
  const isExtendedLengthPath = /^\\\\\?\\/.test(path)

  if (isExtendedLengthPath) {
    return path
  }

  return path.replace(/\\/g, '/')
}
