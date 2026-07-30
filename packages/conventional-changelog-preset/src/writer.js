import {
  commitPartial,
  footerPartial,
  headerPartial,
  preamblePartial,
  template,
} from './templates.js'

const COMMIT_HASH_LENGTH = 7

/**
 * @typedef {import('@conventional-changelog/template').CommitKnownProps & {
 *   scope?: string | null
 *   subject?: string | null
 *   shortHash?: string | null
 * }} EljsCommit
 */

/**
 * @param {import('@conventional-changelog/template').CommitNote} left
 * @param {import('@conventional-changelog/template').CommitNote} right
 */
function compareNotes(left, right) {
  return (
    (left.title || '').localeCompare(right.title || '') ||
    (left.text || '').localeCompare(right.text || '')
  )
}

/**
 * @param {EljsCommit} left
 * @param {EljsCommit} right
 */
function compareCommits(left, right) {
  return (
    (left.scope || '').localeCompare(right.scope || '') ||
    (left.subject || '').localeCompare(right.subject || '')
  )
}

// https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog-angular/src/writer.js
/**
 * @returns {import('conventional-changelog-writer').Options<EljsCommit>}
 */
export function createWriterOpts() {
  /** @type {import('conventional-changelog-writer').Options<EljsCommit>} */
  const writerOptions = {
    template,
    headerPartial,
    preamblePartial,
    commitPartial,
    footerPartial,
    transform: (commit, context) => {
      let discard = true
      const notes = commit.notes.map(note => {
        discard = false

        return {
          ...note,
          title: 'BREAKING CHANGES',
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

      /** @type {Set<string>} */
      const issues = new Set()
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
          // User URLs.
          subject = commit.subject.replace(
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
