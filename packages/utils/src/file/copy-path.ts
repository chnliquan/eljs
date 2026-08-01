/**
 * 将模板路径中的前导短横线转换为点文件前缀
 * @param file - 目标文件路径
 * @param prefix - 模板使用的转义前缀
 * @returns 转换后的目标文件路径
 * @internal
 */
export function normalizeDotfilePath(file: string, prefix = '-'): string {
  if (!file.includes(prefix)) {
    return file
  }

  return file.replace(
    /(^|[\\/])(-{1,2})(?=[^\\/])/g,
    (_match, separator: string, matchedPrefix: string) =>
      separator + (matchedPrefix === prefix + prefix ? prefix : '.'),
  )
}
