export function camelCase(str: string): string {
  return str.replace(/[-_\s]+(.)?/g, function (_, c) {
    return c ? c.toUpperCase() : ''
  })
}

export function pascalCase(str: string): string {
  const camelCaseStr = str.replace(/[-_\s]+(.)?/g, function (_, c) {
    return c ? c.toUpperCase() : ''
  })

  return `${camelCaseStr.slice(0, 1).toUpperCase()}${camelCaseStr.slice(1)}`
}

export function kebabCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '-$1')
    .replace(/[-_\s]+/g, '-')
    .toLowerCase()
}

export function stripBlankLines(str: string): string {
  return str.replace(/(\n[\s|\t]*\r*\n)/g, '\n')
}
