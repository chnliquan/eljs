import type { CommitNote } from '@conventional-changelog/template'
import type { Options as WriterOptions } from 'conventional-changelog-writer'

import { createTemplates } from './templates.js'
import type { EljsCommit } from './types.js'

const COMMIT_HASH_LENGTH = 7

function compareNotes(left: CommitNote, right: CommitNote): number {
  return (
    (left.title || '').localeCompare(right.title || '') ||
    (left.text || '').localeCompare(right.text || '')
  )
}

function compareCommits(left: EljsCommit, right: EljsCommit): number {
  return (
    (left.scope || '').localeCompare(right.scope || '') ||
    (left.subject || '').localeCompare(right.subject || '')
  )
}

/**
 * 创建按类型分组的 Markdown 写入配置，过滤无破坏性变更的辅助提交
 *
 * @remarks 转换仅返回字段补丁，不修改上游提交对象
 * @internal
 */
export async function createWriterOpts(): Promise<WriterOptions<EljsCommit>> {
  const writerOptions: WriterOptions<EljsCommit> = {
    ...(await createTemplates()),
    transform: (commit, context) => {
      let discard = true
      const notes = commit.notes.map(note => {
        discard = false

        return {
          ...note,
          title: '💥 BREAKING CHANGES',
        }
      })

      let type = commit.type

      if (commit.type === `feat`) {
        type = `✨ Features`
      } else if (commit.type === `fix`) {
        type = `🐛 Bug Fixes`
      } else if (commit.type === `perf`) {
        type = `⚡ Performance Improvements`
      } else if (commit.type === `revert`) {
        type = `⏪ Reverts`
      } else if (commit.type === `refactor`) {
        type = `♻ Code Refactoring`
      } else if (discard) {
        return null
      } else if (commit.type === `test`) {
        type = `✅ Tests`
      } else if (commit.type === `docs`) {
        type = `📖 Documentation`
      } else if (commit.type === `style`) {
        type = `💄 Styles`
      } else if (commit.type === `build`) {
        type = `📦 Build System`
      } else if (commit.type === `ci`) {
        type = `🔧 Continuous Integration`
      } else if (commit.type === 'chore') {
        type = '⚙️ Chores'
      }

      const scope = commit.scope === '*' ? '' : commit.scope
      const shortHash =
        typeof commit.hash === 'string'
          ? commit.hash.substring(0, COMMIT_HASH_LENGTH)
          : commit.shortHash

      const issues = new Set<string>()
      let subject = commit.subject

      if (typeof commit.subject === 'string') {
        let url = context.repository
          ? `${context.host}/${context.owner}/${context.repository}`
          : context.repoUrl

        if (url) {
          url = `${url}/issues/`
          // Issue URLs.
          subject = commit.subject.replace(/#([0-9]+)/g, (_, issue) => {
            issues.add(issue)
            return `[#${issue}](${url}${issue})`
          })
        }

        if (context.host) {
          // 在已完成 Issue 链接替换的文本上继续处理，避免覆盖此前的转换结果
          subject = (subject || '').replace(
            /\B@([a-z0-9](?:-?[a-z0-9/]){0,38})/g,
            (_, username) => {
              if (username.includes('/')) {
                return `@${username}`
              }

              return `[@${username}](${context.host}/${username})`
            },
          )
        }
      }

      // remove references that already appear in the subject
      const references = (commit.references || []).filter(
        reference => !issues.has(reference.issue),
      )

      return {
        notes,
        type,
        scope,
        shortHash,
        subject,
        references,
      }
    },
    groupBy: 'type',
    commitGroupsSort: 'title',
    commitsSort: compareCommits,
    noteGroupsSort: 'title',
    notesSort: compareNotes,
  }

  return writerOptions
}
