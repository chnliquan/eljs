import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function checkDocument(file: string): void {
  if (!existsSync(file)) {
    throw new Error(`Missing documentation file: ${file}`)
  }
  let fence: { marker: string; length: number } | undefined
  let hasLanguageLink = false
  const name = path.basename(file)
  const otherLanguage = name.endsWith('.zh-CN.md')
    ? name.replace('.zh-CN.md', '.md')
    : name.replace('.md', '.zh-CN.md')
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  for (const [index, line] of lines.entries()) {
    const marker = /^\s*(`{3,}|~{3,})(.*)$/.exec(line)
    if (fence) {
      if (
        marker &&
        marker[1][0] === fence.marker &&
        marker[1].length >= fence.length &&
        !marker[2].trim()
      ) {
        fence = undefined
      }
      continue
    }
    if (marker) {
      fence = { marker: marker[1][0], length: marker[1].length }
      continue
    }
    // 示例中的 Markdown 属于代码数据；只检查正文中的本地文件链接，不访问网络或解析锚点
    for (const match of line.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const target = match[1].split('#')[0]
      if (!target || /^(?:[a-z][a-z\d+.-]*:|\/)/i.test(target)) continue
      const resolved = path.resolve(
        path.dirname(file),
        decodeURIComponent(target),
      )
      if (!existsSync(resolved)) {
        throw new Error(`${file}:${index + 1}: broken relative link ${target}`)
      }
      if (
        index >= 1 &&
        index < 6 &&
        resolved === path.resolve(path.dirname(file), otherLanguage)
      ) {
        hasLanguageLink = true
      }
    }
  }
  if (fence) throw new Error(`${file}: Unclosed Markdown code fence`)
  if (!hasLanguageLink) {
    throw new Error(`${file}: missing language link after title`)
  }
}

/**
 * 检查必需文档、标题后语言入口、围栏闭合及正文相对链接目标
 *
 * @remarks
 * 根目录检查双语 README 与 CONTRIBUTING，公开包检查双语 README
 * 另一语言入口必须位于首行标题后的五行正文内
 * 跳过 fenced 示例，不比较译文结构、表格或代码，不校验外部 URL 与文档锚点
 * 由 docs:check 命令执行，并纳入 verify:static 静态验证
 *
 * @param root - 本仓库根目录
 * @throws 当文档或语言入口缺失、围栏未闭合、相对链接失效或包清单无法读取时抛出
 * @internal
 */
export function checkDocumentationTree(root: string): void {
  for (const name of [
    'README.md',
    'README.zh-CN.md',
    'CONTRIBUTING.md',
    'CONTRIBUTING.zh-CN.md',
  ]) {
    checkDocument(path.join(root, name))
  }
  const packagesRoot = path.join(root, 'packages')
  if (!existsSync(packagesRoot)) return
  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const directory = path.join(packagesRoot, entry.name)
    const manifest = path.join(directory, 'package.json')
    if (
      !existsSync(manifest) ||
      JSON.parse(readFileSync(manifest, 'utf8')).private
    ) {
      continue
    }
    checkDocument(path.join(directory, 'README.md'))
    checkDocument(path.join(directory, 'README.zh-CN.md'))
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  checkDocumentationTree(fileURLToPath(new URL('..', import.meta.url)))
  console.log('Repository documentation checks passed')
}
