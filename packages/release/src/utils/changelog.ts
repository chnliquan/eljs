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
}

/**
 * 生成更新日志
 * @param options.independent 是否生成独立 tag
 * @returns
 */
export async function generateChangelog(
  options: GenerateChangelogOptions,
): Promise<string> {
  const { cwd = process.cwd(), independent = false } = options

  const conventionalChangelog = (await import('conventional-changelog')).default
  const config = (await import('@eljs/conventional-changelog-preset')).default

  return new Promise((resolve, reject) => {
    const stream = conventionalChangelog(
      // https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-core#conventionalchangelogcoreoptions-context-gitrawcommitsopts-parseropts-writeropts
      {
        cwd,
        config,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        tagPrefix: independent ? /^.+@/ : '',
        // tagPrefix: independent ? `${pkgName}@` : '',
      },
      {
        commit: 'commit',
      },
      undefined,
      undefined,
      {
        // https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog-core/lib/merge-config.js#L305
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
              context.currentTag = independent
                ? context.previousTag.replace(
                    /(\d+\.\d+\.\d+)/,
                    context.version,
                  )
                : guessNextTag(context.previousTag, context.version)
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
    )

    stream.pipe(concat(result => resolve(result.toString().trim())))
    stream.on('error', reject)
  })
}

function guessNextTag(previousTag: string, version: string) {
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
