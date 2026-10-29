import type { ParserStreamOptions } from 'conventional-commits-parser'

/**
 * 创建支持 Angular 风格提交头、Conventional Commits 破坏性变更与撤销提交的解析配置
 *
 * @internal
 */
export function createParserOpts(): ParserStreamOptions {
  return {
    headerPattern: /^(\w*)(?:\((.*)\))?!?: (.*)$/,
    headerCorrespondence: ['type', 'scope', 'subject'],
    breakingHeaderPattern: /^(\w*)(?:\((.*)\))?!: (.*)$/,
    noteKeywords: ['BREAKING CHANGE', 'BREAKING-CHANGE'],
    revertPattern:
      /^(?:Revert|revert:)\s"?([\s\S]+?)"?\s*This reverts commit (\w{7,40})\b/i,
    revertCorrespondence: ['header', 'hash'],
  }
}
