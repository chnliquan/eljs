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

import type { Api } from '../../types'
import { AppError, getChangelog } from '../../utils'

export default (api: Api) => {
  api.onCheck(async () => {
    const { requireClean, requireBranch } = api.config.git

    if (requireClean) {
      api.step('Checking git ...')

      if (
        !(await isGitClean({
          cwd: api.cwd,
          verbose: true,
        }))
      ) {
        throw new AppError('Git working tree is not clean.')
      }

      if (
        await isGitBehindRemote({
          cwd: api.cwd,
          verbose: true,
        })
      ) {
        throw new AppError('Git working tree is behind remote.')
      }
    }

    if (requireBranch && api.appData.branch !== requireBranch) {
      throw new AppError(
        `Require branch ${requireBranch}\`, but got ${chalk.cyan(api.appData.branch)}.`,
      )
    }
  })

  api.getChangelog(
    async () => {
      const { changelog, independent } = api.config.git

      if (!changelog) {
        return ''
      }

      return getChangelog({
        cwd: api.cwd,
        independent,
        ...changelog,
      })
    },
    {
      stage: 10,
    },
  )

  api.onBeforeRelease(async ({ changelog }) => {
    if (!changelog || !api.config.git.changelog) {
      return
    }

    const { filename, placeholder } = api.config.git.changelog
    const changelogFile = path.join(api.cwd, filename)

    api.step(`Writing changelog to ${changelogFile} ...`)

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

  api.onRelease(async ({ version }) => {
    const { independent, commit, commitMessage, commitArgs, push, pushArgs } =
      api.config.git
    const { pkgNames, latestTag } = api.appData

    if (!commit) {
      return
    }

    api.step('Committing changes ...')

    const commitMsg = commitMessage.replace('${version}', version)
    await gitCommit(commitMsg, [...normalizeArgs(commitArgs)].filter(Boolean), {
      cwd: api.cwd,
      verbose: true,
    })

    const tags = independent
      ? pkgNames.map(pkgName => `${pkgName}@${version}`)
      : [`v${version}`]

    for await (const tagName of tags) {
      try {
        await gitTag(tagName, {
          cwd: api.cwd,
          verbose: true,
        })
      } catch (error) {
        const err = error as Error
        if (
          (/tag '.+' already exists/.test(err.message) ||
            /标签 '.+' 已存在/.test(err.message)) &&
          latestTag === tagName
        ) {
          logger.warn(`Tag ${chalk.cyan(tagName)} already exists.`)
        } else {
          throw err
        }
      }
    }

    if (!push) {
      return
    }

    await gitPush([...normalizeArgs(pushArgs)].filter(Boolean), {
      cwd: api.cwd,
      verbose: true,
    })
  })
}
