import {
  bold,
  compareUrl,
  each,
  heading,
  link,
  list,
  newline,
  reference,
  referenceRepositoryUrl,
  repositoryUrl,
  segments,
  strings,
  url,
  words,
} from '@conventional-changelog/template'

/**
 * @typedef {import('@conventional-changelog/template').CommitKnownProps & {
 *   scope?: string | null
 *   subject?: string | null
 *   shortHash?: string | null
 * }} EljsCommit
 */

/** @typedef {import('@conventional-changelog/template').FinalTemplateContext<EljsCommit>} EljsContext */
/** @typedef {import('@conventional-changelog/template').TransformedCommit<EljsCommit>} EljsTransformedCommit */

/**
 * @param {EljsContext} context
 */
export function headerPartial(context) {
  const { isPatch, linkCompare, version, title, date } = context
  const versionText = linkCompare
    ? link(version || '', compareUrl(context))
    : version

  return heading(
    Number(Boolean(isPatch)) + 1,
    words(versionText, title && `"${title}"`, date && `(${date})`),
  )
}

/**
 * @param {EljsContext} context
 */
export function preamblePartial(context) {
  return strings(context.preamble)
}

/**
 * @param {EljsContext} context
 * @param {EljsTransformedCommit} commit
 */
export function commitPartial(context, commit) {
  const { linkReferences, issue, commit: commitUrlPath } = context
  const { scope, subject, header, shortHash, hash, references } = commit
  const commitLink = hash
    ? linkReferences
      ? `(${link(
          shortHash || hash,
          url(repositoryUrl(context), commitUrlPath, hash),
        )})`
      : shortHash
    : ''
  const renderedReferences = each(
    references,
    linkReference => {
      if (linkReferences) {
        return link(
          reference(linkReference),
          url(
            referenceRepositoryUrl(context, linkReference),
            issue,
            linkReference.issue,
          ),
        )
      }

      return reference(linkReference)
    },
    ' ',
  )

  return strings(
    words(scope && bold(`${scope}:`), subject || header || '', commitLink),
    renderedReferences && `, closes ${renderedReferences}`,
  )
}

/**
 * @param {EljsContext} context
 */
export function footerPartial({ noteGroups }) {
  return each(
    noteGroups,
    group =>
      segments(
        heading(3, group.title),
        list(group.notes, note => {
          const commitNote =
            /** @type {typeof note & { commit?: EljsCommit }} */ (note)

          return words(
            commitNote.commit?.scope && bold(`${commitNote.commit.scope}:`),
            commitNote.text,
          )
        }),
      ),
    newline(2),
  )
}

/**
 * @param {EljsContext} context
 */
export function template(context) {
  const {
    headerPartial,
    preamblePartial,
    commitPartial,
    footerPartial,
    commitGroups,
  } = context

  return segments(
    headerPartial(context),
    preamblePartial(context),
    each(
      commitGroups,
      group =>
        segments(
          group.title && heading(3, group.title),
          list(group.commits, commit => commitPartial(context, commit)),
        ),
      newline(2),
    ),
    footerPartial(context),
  )
}
