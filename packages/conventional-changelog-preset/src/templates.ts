import type { Options as WriterOptions } from 'conventional-changelog-writer'

import type { EljsCommit, EljsContext, EljsTransformedCommit } from './types.js'

/**
 * 写入器所需的完整渲染函数集合，异步加载完成后不再依赖模块初始化状态
 */
type TemplateRenderers = Required<
  Pick<
    WriterOptions<EljsCommit>,
    | 'template'
    | 'headerPartial'
    | 'preamblePartial'
    | 'commitPartial'
    | 'footerPartial'
  >
>

/**
 * 加载 Markdown 渲染函数，兼容仅提供 ESM 导出的上游模板工具
 *
 * @returns 可同步渲染标题、前言、提交与破坏性变更的函数集合
 * @internal
 */
export async function createTemplates(): Promise<TemplateRenderers> {
  // 上游仅声明 import 条件，动态导入让 CommonJS 入口也能完成异步初始化
  const {
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
  } = await import('@conventional-changelog/template')

  function headerPartial(context: EljsContext): string {
    const { isPatch, linkCompare, version, title, date } = context
    const versionText = linkCompare
      ? link(version || '', compareUrl(context))
      : version

    return heading(
      Number(Boolean(isPatch)) + 1,
      words(versionText, title && `"${title}"`, date && `(${date})`),
    )
  }

  function preamblePartial(context: EljsContext): string {
    return strings(context.preamble)
  }

  function commitPartial(
    context: EljsContext,
    commit: EljsTransformedCommit,
  ): string {
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

  function footerPartial({ noteGroups }: EljsContext): string {
    return each(
      noteGroups,
      group =>
        segments(
          heading(3, group.title),
          list(group.notes, note => {
            // 上游会附加关联提交，但公开说明类型未包含该字段
            const commitNote = note as typeof note & { commit?: EljsCommit }

            return words(
              commitNote.commit?.scope && bold(`${commitNote.commit.scope}:`),
              commitNote.text,
            )
          }),
        ),
      newline(2),
    )
  }

  function template(context: EljsContext): string {
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

  return {
    template,
    headerPartial,
    preamblePartial,
    commitPartial,
    footerPartial,
  }
}
