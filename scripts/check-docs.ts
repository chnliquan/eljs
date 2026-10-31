import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

/**
 * 双语文档中需要保持一致的结构与可执行示例
 *
 * @remarks
 * 文本输出和目录示意允许翻译，代码与命令只允许注释和空白变化
 * 结构检查不能替代对正文语义及 API 行为的人工审查
 */
interface DocumentContract {
  headingLevels: number[]
  tableRows: number[]
  code: Array<{ language: string; content: string }>
  prose: string
}

function parseDocument(markdown: string): DocumentContract {
  const result: DocumentContract = {
    headingLevels: [],
    tableRows: [],
    code: [],
    prose: '',
  }
  let fence: { marker: string; language: string; lines: string[] } | undefined
  let rows = 0
  const flushTable = () => {
    if (rows) result.tableRows.push(rows)
    rows = 0
  }

  for (const line of markdown.split(/\r?\n/)) {
    if (fence) {
      if (line.trimEnd() === fence.marker) {
        result.code.push({
          language: fence.language,
          content: fence.lines.join('\n'),
        })
        fence = undefined
      } else {
        fence.lines.push(line)
      }
      continue
    }
    const opening = /^(`{3,}|~{3,})(\w*)\s*$/.exec(line)
    if (opening) {
      flushTable()
      fence = { marker: opening[1], language: opening[2], lines: [] }
      continue
    }
    const heading = /^(#{1,6})\s/.exec(line)
    if (heading) result.headingLevels.push(heading[1].length)
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (!/^\s*\|[\s:|-]+\|\s*$/.test(line)) rows++
    } else {
      flushTable()
    }
    result.prose += `${line}\n`
  }
  flushTable()
  if (fence) throw new Error('Unclosed Markdown code fence')
  return result
}

function codeTokens(language: string, content: string): string[] | undefined {
  if (
    ['ts', 'tsx', 'typescript', 'js', 'javascript', 'json'].includes(language)
  ) {
    // 使用语法树提供的 token 边界，避免模板字符串后的注释被普通 scanner 误读
    const source = ts.createSourceFile(
      'example.ts',
      content,
      ts.ScriptTarget.Latest,
      true,
      language === 'tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    const tokens: string[] = []
    const collect = (node: ts.Node) => {
      const children = node.getChildren(source)
      if (children.length) {
        children.forEach(collect)
      } else if (
        node.kind >= ts.SyntaxKind.FirstToken &&
        node.kind <= ts.SyntaxKind.LastToken &&
        node.kind !== ts.SyntaxKind.EndOfFileToken
      ) {
        tokens.push(node.getText(source))
      }
    }
    collect(source)
    return tokens
  }
  if (['bash', 'sh', 'yaml', 'yml'].includes(language)) {
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
  }
  return undefined
}

/**
 * 校验双语入口、章节层级、表格行数、可执行示例与本地链接目标
 *
 * @param directory - 文档所在目录
 * @param files - 英文与中文入口文件名，默认检查 README
 * @throws 双语交付合同不一致或相对链接目标不存在时抛出
 * @internal
 */
export function checkDocumentPair(
  directory: string,
  files: readonly [string, string] = ['README.md', 'README.zh-CN.md'],
): void {
  const documents = files.map(file => {
    const markdown = readFileSync(path.join(directory, file), 'utf8')
    const otherLanguage = file === files[0] ? files[1] : files[0]
    if (
      !markdown
        .split(/\r?\n/)
        .slice(1, 6)
        .some(line => line.includes(otherLanguage))
    ) {
      throw new Error(`${directory}/${file}: missing language link after title`)
    }
    const contract = parseDocument(markdown)
    for (const match of contract.prose.matchAll(
      /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    )) {
      const target = match[1].split('#')[0]
      if (!target || /^(?:[a-z][a-z\d+.-]*:|\/)/i.test(target)) continue
      if (!existsSync(path.resolve(directory, decodeURIComponent(target)))) {
        throw new Error(`${directory}/${file}: broken relative link ${target}`)
      }
    }
    return contract
  })
  const [english, chinese] = documents
  const assertEqual = (left: unknown, right: unknown, label: string) => {
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      throw new Error(`${directory}: bilingual ${label} differ`)
    }
  }
  assertEqual(english.headingLevels, chinese.headingLevels, 'heading levels')
  assertEqual(english.tableRows, chinese.tableRows, 'table rows')
  assertEqual(
    english.code.map(block => block.language),
    chinese.code.map(block => block.language),
    'code fence languages',
  )
  english.code.forEach((block, index) => {
    const expected = codeTokens(block.language, block.content)
    if (expected) {
      assertEqual(
        expected,
        codeTokens(chinese.code[index].language, chinese.code[index].content),
        `executable code block ${index + 1}`,
      )
    }
  })
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = fileURLToPath(new URL('..', import.meta.url))
  checkDocumentPair(root)
  checkDocumentPair(root, ['CONTRIBUTING.md', 'CONTRIBUTING.zh-CN.md'])
  for (const entry of readdirSync(path.join(root, 'packages'), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue
    const directory = path.join(root, 'packages', entry.name)
    const manifest = JSON.parse(
      readFileSync(path.join(directory, 'package.json'), 'utf8'),
    )
    if (!manifest.private) checkDocumentPair(directory)
  }
  console.log('Bilingual documentation contracts passed')
}
