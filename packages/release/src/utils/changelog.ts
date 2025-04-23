import concat from 'concat-stream'

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
   * @link https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog/README.md#presets
   */
  preset?: string
}

/**
 * 获取更新日志
 * @param options.cwd 当前工作目录
 * @param options.independent 是否生成独立 tag
 * @param options.preset conventional-changelog 预设
 */
export async function getChangelog(
  options: GenerateChangelogOptions,
): Promise<string> {
  const conventionalChangelog = (await import('conventional-changelog')).default
  const conventionalChangelogOptions =
    await getConventionalChangelogOptions(options)

  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const stream = conventionalChangelog(...conventionalChangelogOptions)
    stream.pipe(concat(result => resolve(result.toString().trim())))
    stream.on('error', reject)
  })
}

async function getConventionalChangelogOptions(
  options: GenerateChangelogOptions,
) {
  const { cwd = process.cwd(), independent = false, preset } = options

  if (preset) {
    return [
      {
        cwd,
        preset,
      },
    ]
  } else {
    const config = (await import('@eljs/conventional-changelog-preset')).default
    const tagPrefix = independent ? /^.+@/ : ''

    return [
      // https://github.com/conventional-changelog/conventional-changelog/blob/standard-changelog-v6.0.0/packages/conventional-changelog/index.js#L21
      // options
      {
        cwd,
        config,
        tagPrefix,
      },
      // context
      {
        commit: 'commit',
      },
      // gitRawCommitsOpts
      {},
      // parserOpts
      {},
      {
        // https://github.com/conventional-changelog/conventional-changelog/blob/standard-changelog-v6.0.0/packages/conventional-changelog-core/lib/merge-config.js#L305
        finalizeContext: function (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          context: any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          writerOpts: any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          filteredCommits: any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          keyCommit: any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          originalCommits: any,
        ) {
          const semverTags = context.gitSemverTags
          const firstCommit = originalCommits[0]
          const lastCommit = originalCommits[originalCommits.length - 1]
          const firstCommitHash = firstCommit ? firstCommit.hash : null
          const lastCommitHash = lastCommit ? lastCommit.hash : null

          if ((!context.currentTag || !context.previousTag) && keyCommit) {
            const match = /tag:\s*(.+?)[,)]/gi.exec(keyCommit.gitTags)
            const currentTag = context.currentTag
            context.currentTag = currentTag || match ? match?.[1] : null
            const index = semverTags.indexOf(context.currentTag)

            // if `keyCommit.gitTags` is not a semver
            if (index === -1) {
              context.currentTag = currentTag || null
            } else {
              const previousTag = (context.previousTag = semverTags[index + 1])

              if (!previousTag) {
                context.previousTag = context.previousTag || lastCommitHash
              }
            }
          } else {
            context.previousTag = context.previousTag || semverTags[0]

            if (context.version === 'Unreleased') {
              context.currentTag = context.currentTag || firstCommitHash
            } else if (!context.currentTag) {
              context.currentTag = guessNextTag(context, independent)
            }
          }

          if (
            typeof context.linkCompare !== 'boolean' &&
            context.previousTag &&
            context.currentTag
          ) {
            context.linkCompare = true
          }

          return context
        },
      },
    ]
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function guessNextTag(context: any, independent?: boolean) {
  const { previousTag, version } = context

  if (independent) {
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
