import { isPathExistsSync, logger } from '@eljs/utils'
import fs from 'fs'
import os from 'os'
import path from 'path'

export async function generateChangelog(opts: {
  pkgName: string
  latest?: boolean
  cwd?: string
  independent?: boolean
}): Promise<string> {
  const {
    pkgName,
    latest = true,
    cwd = process.cwd(),
    independent = false,
  } = opts
  const CHANGELOG = path.join(cwd, 'CHANGELOG.md')
  const LATESTLOG = path.join(cwd, 'LATESTLOG.md')
  let hasError = false

  const conventionalChangelog = (await import('conventional-changelog')).default
  const config = (await import('@eljs/conventional-changelog-preset')).default

  return new Promise((resolve, reject) => {
    const stream = conventionalChangelog(
      // https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-core#conventionalchangelogcoreoptions-context-gitrawcommitsopts-parseropts-writeropts
      {
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

    let changelog = ''
    let latestLog = ''

    stream.on('data', chunk => {
      try {
        let data: string = chunk.toString()

        if (data.indexOf('###') === -1) {
          data = data.replace(
            /\n+/g,
            `\n\n**Note:** Version bump only for package ${pkgName}`,
          )
        }

        if (isPathExistsSync(CHANGELOG)) {
          const remain = fs.readFileSync(CHANGELOG, 'utf8').trim()
          changelog = remain.length
            ? remain.replace(/# Change\s?Log/, '# ChangeLog \n\n' + data)
            : '# ChangeLog \n\n' + data
        } else {
          changelog = '# ChangeLog \n\n' + data
        }

        fs.writeFileSync(CHANGELOG, changelog)

        if (!latest) {
          return
        }

        const lines = data.split(os.EOL)
        let firstIndex = -1

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]

          if (/^#{1,3}/.test(line)) {
            firstIndex = i
            break
          }
        }

        if (firstIndex > -1) {
          latestLog = data.replace(/##* \[([\d.]+)\]/, '## [Changes]')

          fs.writeFileSync(LATESTLOG, latestLog)
          logger.done(`Generated LATESTLOG successfully.`)
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        hasError = true
        reject(err.stack)
      }
    })

    stream.on('error', err => {
      if (hasError) {
        return
      }

      hasError = true
      reject(err.stack)
    })

    stream.on('end', () => {
      if (hasError) {
        return
      }

      logger.done(`Generated CHANGELOG successfully.`)
      resolve(latestLog)
    })
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
