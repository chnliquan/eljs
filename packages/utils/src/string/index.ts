/**
 * 小驼峰格式
 * @param str 字符串
 */
export function camelCase(str: string): string {
  return str.replace(/[-_\s]+(.)?/g, function (_, c) {
    return c ? c.toUpperCase() : ''
  })
}

/**
 * 大驼峰格式
 * @param str 字符串
 */
export function pascalCase(str: string): string {
  const camelCaseStr = str.replace(/[-_\s]+(.)?/g, function (_, c) {
    return c ? c.toUpperCase() : ''
  })

  return `${camelCaseStr.slice(0, 1).toUpperCase()}${camelCaseStr.slice(1)}`
}

/**
 * 中划线格式
 * @param str 字符串
 */
export function kebabCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '-$1')
    .replace(/^-/, '')
    .replace(/[-_\s]+/g, '-')
    .toLowerCase()
}

/**
 * 去除空白行
 * @param str 字符串
 */
export function stripBlankLines(str: string): string {
  return str
    .replace(/(\n[\s\t]*\r*\n)/g, '\n') // 替换空白行
    .replace(/^[\s\t]*\n+|[\s\t]*\n+$/g, '') // 移除开头和结尾的空白行
    .replace(/^[\s\t]*$/, '') // 如果整个字符串只有空白字符，返回空字符串
}
