import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { checkDocumentationTree } from '../check-docs'

const roots: string[] = []
const rootDocuments = [
  'README.md',
  'README.zh-CN.md',
  'CONTRIBUTING.md',
  'CONTRIBUTING.zh-CN.md',
]

function document(name: string, title = 'Documentation'): string {
  const otherLanguage = name.endsWith('.zh-CN.md')
    ? name.replace('.zh-CN.md', '.md')
    : name.replace('.md', '.zh-CN.md')
  return `# ${title}\n\n[Other language](./${otherLanguage})\n`
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'eljs-repo-docs-'))
  roots.push(root)
  await Promise.all(
    rootDocuments.map(name => writeFile(path.join(root, name), document(name))),
  )
  return root
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(root => rm(root, { recursive: true, force: true })),
  )
})

describe('仓库轻量文档检查', () => {
  it.each(rootDocuments)('要求根目录文档 %s', async name => {
    const root = await fixture()
    await rm(path.join(root, name))
    expect(() => checkDocumentationTree(root)).toThrow(name)
  })

  it('不比较翻译的正文标题、表格或代码', async () => {
    const root = await fixture()
    await writeFile(
      path.join(root, 'README.md'),
      `${document('README.md', 'English')}\n\`\`\`sh\necho one\n\`\`\`\n`,
    )
    await writeFile(
      path.join(root, 'README.zh-CN.md'),
      `${document('README.zh-CN.md', '中文')}\n## 更多说明\n\n| 一 | 二 |\n| - | - |\n| 值 | 值 |\n\n\`\`\`sh\necho two\n\`\`\`\n`,
    )
    expect(() => checkDocumentationTree(root)).not.toThrow()
  })

  it.each(rootDocuments)('要求根目录 %s 标题后的语言入口', async name => {
    const root = await fixture()
    await writeFile(path.join(root, name), '# Documentation\n')
    expect(() => checkDocumentationTree(root)).toThrow(
      `${path.join(root, name)}: missing language link after title`,
    )
  })

  it.each([
    '# Documentation\n\nREADME.zh-CN.md\n',
    '# Documentation\n\n```\n[中文](README.zh-CN.md)\n```\n',
    '# Documentation\n\n\n\n\n\n[中文](README.zh-CN.md)\n',
  ])('文件名、代码示例或过晚的链接不能充当语言入口：%s', async content => {
    const root = await fixture()
    await writeFile(path.join(root, 'README.md'), content)
    expect(() => checkDocumentationTree(root)).toThrow(
      'missing language link after title',
    )
  })

  it('允许语言入口位于标题后的第五行', async () => {
    const root = await fixture()
    await writeFile(
      path.join(root, 'README.md'),
      '# Documentation\n\n\n\n\n[中文](README.zh-CN.md)\n',
    )
    expect(() => checkDocumentationTree(root)).not.toThrow()
  })

  it('检查相对文件链接，跳过锚点、外部 URL 和绝对路径', async () => {
    const root = await fixture()
    await writeFile(path.join(root, 'local file.md'), '# Target\n')
    await writeFile(
      path.join(root, 'README.md'),
      [
        document('README.md').trimEnd(),
        '[local](local%20file.md#missing-anchor "Local file")',
        '[anchor](#missing-anchor)',
        '[external](https://example.invalid/missing)',
        '[mail](mailto:example@example.invalid)',
        '[absolute](/absent.md)',
        '',
      ].join('\n'),
    )
    expect(() => checkDocumentationTree(root)).not.toThrow()
    await writeFile(
      path.join(root, 'README.md'),
      `${document('README.md')}[broken](missing.md)\n`,
    )
    expect(() => checkDocumentationTree(root)).toThrow(
      `${path.join(root, 'README.md')}:4: broken relative link missing.md`,
    )
  })

  it.each(['```', '~~~', '````'])(
    '跳过 %s 示例直到相同标记且长度足够的结束围栏',
    async marker => {
      const root = await fixture()
      await writeFile(
        path.join(root, 'README.md'),
        [
          document('README.md').trimEnd(),
          `${marker}md`,
          '[sample](missing-sample.md)',
          marker.startsWith('`') ? '~~~' : '```',
          marker.slice(1),
          '[nested sample](missing-nested.md)',
          marker,
          '[local](CONTRIBUTING.md)',
          '',
        ].join('\n'),
      )
      expect(() => checkDocumentationTree(root)).not.toThrow()
      await writeFile(
        path.join(root, 'README.md'),
        `${document('README.md')}${marker}md\n[sample](missing.md)\n${marker}\n[broken](after.md)\n`,
      )
      expect(() => checkDocumentationTree(root)).toThrow(
        'broken relative link after.md',
      )
    },
  )

  it.each(['```', '~~~', '````'])('拒绝未闭合的 %s 围栏', async marker => {
    const root = await fixture()
    await writeFile(
      path.join(root, 'README.md'),
      `${document('README.md')}${marker}md\n[sample](missing.md)\n${marker.slice(1)}\n`,
    )
    expect(() => checkDocumentationTree(root)).toThrow(
      `${path.join(root, 'README.md')}: Unclosed Markdown code fence`,
    )
  })

  it('要求公开包 README 并相对包目录解析链接', async () => {
    const root = await fixture()
    const pkg = path.join(root, 'packages/example')
    await mkdir(pkg, { recursive: true })
    await writeFile(
      path.join(pkg, 'package.json'),
      JSON.stringify({ name: '@eljs/example', private: false }),
    )
    await writeFile(
      path.join(pkg, 'README.md'),
      `${document('README.md', 'Example')}[root](../../README.md)\n`,
    )
    expect(() => checkDocumentationTree(root)).toThrow('README.zh-CN.md')
    await writeFile(
      path.join(pkg, 'README.zh-CN.md'),
      document('README.zh-CN.md', '示例'),
    )
    expect(() => checkDocumentationTree(root)).not.toThrow()
    await rm(path.join(pkg, 'README.md'))
    expect(() => checkDocumentationTree(root)).toThrow('README.md')
  })

  it.each(['README.md', 'README.zh-CN.md'])(
    '要求公开包 %s 标题后的语言入口',
    async name => {
      const root = await fixture()
      const pkg = path.join(root, 'packages/example')
      await mkdir(pkg, { recursive: true })
      await writeFile(
        path.join(pkg, 'package.json'),
        JSON.stringify({ name: '@eljs/example' }),
      )
      for (const file of ['README.md', 'README.zh-CN.md']) {
        await writeFile(path.join(pkg, file), document(file))
      }
      await writeFile(path.join(pkg, name), '# Example\n')
      expect(() => checkDocumentationTree(root)).toThrow(
        `${path.join(pkg, name)}: missing language link after title`,
      )
    },
  )

  it('不检查私有包、无清单目录或临时 fixture', async () => {
    const root = await fixture()
    for (const directory of ['packages/private', 'temp/leftover']) {
      const target = path.join(root, directory)
      await mkdir(target, { recursive: true })
      await writeFile(
        path.join(target, 'package.json'),
        JSON.stringify({ private: directory.startsWith('packages/') }),
      )
    }
    await mkdir(path.join(root, 'packages/no-manifest'))
    await writeFile(path.join(root, 'packages/not-a-directory'), 'unused')
    expect(() => checkDocumentationTree(root)).not.toThrow()
  })
})
