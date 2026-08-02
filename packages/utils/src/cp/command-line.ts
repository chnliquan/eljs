const WHITESPACE_REGEXP = /\s+/g

/**
 * 将命令行文本解析为命令和参数
 *
 * @remarks
 * 该解析器不经过 shell，只支持以反斜杠转义参数中的空白字符
 *
 * @param commandLine - 命令行文本
 * @returns 命令及参数组成的数组，空白输入返回空数组
 */
export function parseCommandLine(commandLine: string): string[] {
  const trimmedCommandLine = commandLine.trim()

  if (!trimmedCommandLine) {
    return []
  }

  const tokens: string[] = []

  for (const token of trimmedCommandLine.split(WHITESPACE_REGEXP)) {
    const previousToken = tokens.at(-1)

    if (previousToken?.endsWith('\\')) {
      tokens[tokens.length - 1] = `${previousToken.slice(0, -1)} ${token}`
    } else {
      tokens.push(token)
    }
  }

  return tokens
}
