import {
  chalk,
  gitCommit,
  gitPush,
  gitTag,
  isGitBehindRemote,
  isGitClean,
  isPathExists,
  logger,
  normalizeArgs,
  readFile,
  writeFile,
} from '@eljs/utils'
import { EOL } from 'node:os'
import path from 'node:path'

import { definePlugin } from '../../define'
import { AppError, getChangelog, isGitTagAtHead } from '../../utils'

export default definePlugin(context => {
  context.onCheck(async () => {
    const { requireClean, requireBranch } = context.config.git

    if (requireClean) {
      context.step('Checking git ...')

      if (
        !(await isGitClean({
          cwd: context.cwd,
          verbose: true,
        }))
      ) {
        throw new AppError('Git working tree is not clean.')
      }

      if (
        await isGitBehindRemote({
          cwd: context.cwd,
          verbose: true,
        })
      ) {
        throw new AppError('Git working tree is behind remote.')
      }
    }

    if (requireBranch && context.appData.branch !== requireBranch) {
      throw new AppError(
        `Require branch ${requireBranch}\`, but got ${chalk.cyan(context.appData.branch)}.`,
      )
    }
  })

  context.getChangelog(
    async () => {
      const { changelog, independent } = context.config.git

      if (!changelog) {
        return ''
      }

      return getChangelog({
        cwd: context.cwd,
        independent,
        ...changelog,
      })
    },
    {
      stage: 10,
    },
  )

  context.onBeforeRelease(async ({ changelog }) => {
    if (!changelog || !context.config.git.changelog) {
      return
    }

    const { filename, placeholder } = context.config.git.changelog
    const changelogFile = path.join(context.cwd, filename)

    context.step(`Writing changelog to ${changelogFile} ...`)

    if (changelog.indexOf('###') === -1) {
      changelog = changelog.replace(new RegExp(EOL, 'g'), '')
      changelog += `${EOL}${EOL}${placeholder}`
    }

    if (await isPathExists(changelogFile)) {
      const remain = (await readFile(changelogFile)).trim()
      changelog = remain.length
        ? remain.replace(
            /# Change\s?Log/,
            `# ChangeLog ${EOL}${EOL}${changelog}`,
          )
        : `# ChangeLog ${EOL}${EOL}${changelog}`
    } else {
      changelog = `# ChangeLog ${EOL}${EOL}${changelog}`
    }

    await writeFile(changelogFile, changelog)
  })

  context.onRelease(
    async ({ version }) => {
      const { independent, commit, commitMessage, commitArgs } =
        context.config.git
      const { pkgNames } = context.appData

      if (!commit) {
        return
      }

      context.step('Committing changes ...')

      const commitMsg = commitMessage.replace('${version}', version)
      await gitCommit(
        commitMsg,
        [...normalizeArgs(commitArgs)].filter(Boolean),
        {
          cwd: context.cwd,
          verbose: true,
        },
      )

      const tags = independent
        ? pkgNames.map(pkgName => `${pkgName}@${version}`)
        : [`v${version}`]

      for (const tagName of tags) {
        try {
          await gitTag(tagName, {
            cwd: context.cwd,
            verbose: true,
          })
        } catch (error) {
          const err = error as Error
          const tagExists =
            /tag '.+' already exists/.test(err.message) ||
            /标签 '.+' 已存在/.test(err.message)

          if (
            tagExists &&
            (await isGitTagAtHead(tagName, {
              cwd: context.cwd,
              verbose: false,
            }))
          ) {
            logger.warn(`Tag ${chalk.cyan(tagName)} already exists.`)
          } else {
            throw err
          }
        }
      }
    },
    {
      // Keep the release state local until every package has been published.
      stage: -10,
    },
  )

  context.onRelease(
    async () => {
      const { commit, push, pushArgs } = context.config.git

      if (!commit || !push) {
        return
      }

      context.step('Pushing release commit and tags ...')
      await gitPush([...normalizeArgs(pushArgs)].filter(Boolean), {
        cwd: context.cwd,
        verbose: true,
      })
    },
    {
      stage: 10,
    },
  )
})
