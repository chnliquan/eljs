// https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog-angular/src/parser.js
export function createParserOpts() {
  return {
    headerPattern: /^(\w*)(?:\((.*)\))?: (.*)$/,
    headerCorrespondence: ['type', 'scope', 'subject'],
    noteKeywords: ['BREAKING CHANGE'],
    revertPattern:
      /^(?:Revert|revert:)\s"?([\s\S]+?)"?\s*This reverts commit (\w{7,40})\b/i,
    revertCorrespondence: ['header', 'hash'],
  }
}
