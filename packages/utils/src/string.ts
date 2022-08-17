export function camelize(str: string, bigCamelCase = false): string {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const formattedStr = str.replace(/[-_\s]+(.)?/g, function (_, c) {
    return c ? c.toUpperCase() : ''
  })

  return bigCamelCase
    ? `${formattedStr.slice(0, 1).toUpperCase()}${formattedStr.slice(1)}`
    : formattedStr
}

export function dasherize(str: string): string {
  return str
    .replace(/([A-Z])/g, '-$1')
    .replace(/[-_\s]+/g, '-')
    .toLowerCase()
}
