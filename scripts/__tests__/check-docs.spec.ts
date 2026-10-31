import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { checkDocumentPair } from '../check-docs'

let directory: string
const english = `# Example

[简体中文](README.zh-CN.md)

## Usage

\`\`\`ts
// A translated comment
const value = "https://example.org/path"
console.log(\`Value: \${value}\`)
// After a template string
\`\`\`

| Option | Default |
| --- | --- |
| value | 1 |
`
const chinese = english
  .replace('[简体中文](README.zh-CN.md)', '[English](README.md)')
  .replace('## Usage', '## 使用')
  .replace('// A translated comment', '// 翻译后的注释')
  .replace('// After a template string', '// 模板字符串之后的注释')

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'eljs-docs-check-'))
  await writeFile(path.join(directory, 'README.md'), english)
  await writeFile(path.join(directory, 'README.zh-CN.md'), chinese)
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('双语文档合同校验', () => {
  it('允许标题和注释翻译，保留字符串中的 //', () => {
    expect(() => checkDocumentPair(directory)).not.toThrow()
  })

  it('同一检查覆盖贡献指南并检测中文命令偏差', async () => {
    const guideEnglish = english.replaceAll('README', 'CONTRIBUTING')
    const guideChinese = chinese.replaceAll('README', 'CONTRIBUTING')
    await writeFile(path.join(directory, 'CONTRIBUTING.md'), guideEnglish)
    await writeFile(path.join(directory, 'CONTRIBUTING.zh-CN.md'), guideChinese)
    const files = ['CONTRIBUTING.md', 'CONTRIBUTING.zh-CN.md'] as const
    expect(() => checkDocumentPair(directory, files)).not.toThrow()
    await writeFile(
      path.join(directory, 'CONTRIBUTING.zh-CN.md'),
      guideChinese.replace('console.log(', 'console.error('),
    )
    expect(() => checkDocumentPair(directory, files)).toThrow('executable code')
  })

  it.each([
    ['code', chinese.replace('console.log(', 'console.error(')],
    ['string', chinese.replace('example.org', 'different.org')],
    ['heading', chinese.replace('## 使用', '### 使用')],
    ['table', chinese.replace('| value | 1 |', '| value | 1 |\n| extra | 2 |')],
    ['link', `${chinese}\n[Missing](./absent.md)\n`],
    ['fence', chinese.replace('\n```\n\n| Option', '\n\n| Option')],
    ['language', chinese.replace('[English](README.md)', '')],
  ])('检测 %s 合同回归', async (_label, content) => {
    await writeFile(path.join(directory, 'README.zh-CN.md'), content)
    expect(() => checkDocumentPair(directory)).toThrow()
  })
})
