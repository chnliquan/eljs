import concat from 'concat-stream'
import type { FinalizedContext, Preset } from 'conventional-changelog'

export interface GenerateChangelogOptions {
  /**
   * 当前工作目录
   */
  cwd?: string
  /**
   * 是否生成独立 tag
   */
  independent?: boolean
  /**
   * conventional-changelog 预设
   *
   * {@link https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog/README.md#presets}
   */
  preset?: string
}

/**
 * 获取更新日志
 * @param options - 更新日志生成选项
 */
export async function getChangelog(
  options: GenerateChangelogOptions,
): Promise<string> {
  const { cwd = process.cwd(), independent = false, preset } = options
  const { ConventionalChangelog } = await import('conventional-changelog')
  const generator = new ConventionalChangelog(cwd).readPackage()

  if (preset) {
    generator.loadPreset(preset)
  } else {
    const createPreset = (await import('@eljs/conventional-changelog-preset'))
      .default

    generator
      .config(createPreset())
      .context({ commit: 'commit' })
      .writer({ finalizeContext: createFinalizeContext(independent) })

    if (independent) {
      generator.tags({ prefix: /^.+@/ })
    }
  }

  return new Promise((resolve, reject) => {
    const stream = generator.writeStream()
    stream.pipe(concat(result => resolve(result.toString().trim())))
    stream.on('error', reject)
  })
}

type FinalizeContext = NonNullable<
  NonNullable<Preset['writer']>['finalizeContext']
>

function createFinalizeContext(independent: boolean): FinalizeContext {
  return function finalizeContext(
    context,
    _writerOpts,
    _filteredCommits,
    keyCommit,
    originalCommits,
  ) {
    const changelogContext = context as typeof context & {
      gitSemverTags?: string[]
    }
    const changelogKeyCommit = keyCommit as
      | (NonNullable<typeof keyCommit> & {
          gitTags?: string | null
        })
      | null
    const semverTags = changelogContext.gitSemverTags ?? []
    const firstCommit = originalCommits[0]
    const lastCommit = originalCommits[originalCommits.length - 1]
    const firstCommitHash = firstCommit ? firstCommit.hash : null
    const lastCommitHash = lastCommit ? lastCommit.hash : null

    if (
      (!changelogContext.currentTag || !changelogContext.previousTag) &&
      changelogKeyCommit
    ) {
      const match = /tag:\s*(.+?)[,)]/gi.exec(changelogKeyCommit.gitTags ?? '')
      const currentTag = context.currentTag
      changelogContext.currentTag = currentTag || match?.[1] || null
      const index = changelogContext.currentTag
        ? semverTags.indexOf(changelogContext.currentTag)
        : -1

      // if `keyCommit.gitTags` is not a semver
      if (index === -1) {
        changelogContext.currentTag = currentTag || null
      } else {
        const previousTag = (changelogContext.previousTag =
          semverTags[index + 1])

        if (!previousTag) {
          changelogContext.previousTag =
            changelogContext.previousTag || lastCommitHash
        }
      }
    } else {
      changelogContext.previousTag =
        changelogContext.previousTag || semverTags[0]

      if (changelogContext.version === 'Unreleased') {
        changelogContext.currentTag =
          changelogContext.currentTag || firstCommitHash
      } else if (!changelogContext.currentTag) {
        changelogContext.currentTag = guessNextTag(
          changelogContext,
          independent,
        )
      }
    }

    if (
      typeof changelogContext.linkCompare !== 'boolean' &&
      changelogContext.previousTag &&
      changelogContext.currentTag
    ) {
      changelogContext.linkCompare = true
    }

    return changelogContext
  }
}

function guessNextTag(
  context: Pick<FinalizedContext, 'previousTag' | 'version'>,
  independent = false,
): string | null {
  const { previousTag, version } = context

  if (!version) {
    return null
  }

  if (independent && previousTag) {
    return previousTag.replace(
      /(\d+\.\d+\.\d+)/,
      version[0] === 'v' ? version.slice(1) : version,
    )
  }

  if (previousTag) {
    if (previousTag[0] === 'v' && version[0] !== 'v') {
      return 'v' + version
    }

    if (previousTag[0] !== 'v' && version[0] === 'v') {
      return version.replace(/^v/, '')
    }

    return version
  }

  if (version[0] !== 'v') {
    return 'v' + version
  }

  return version
}
