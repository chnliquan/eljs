import type { Api } from '@/types'
import { generateChangelog } from '@/utils'
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
        logger.printErrorAndExit('Git working tree is not clean.')
      }

      if (
        await isGitBehindRemote({
          cwd: api.cwd,
          verbose: true,
        })
      ) {
        logger.printErrorAndExit('Git working tree is behind remote.')
      }
    }

    if (requireBranch && api.appData.branch !== requireBranch) {
      logger.printErrorAndExit(
        `Must be on branch ${chalk.bold(requireBranch)}, but got ${chalk.bold(api.appData.branch)}.`,
      )
    }
  })

  api.getChangelog(
    async () => {
      const { changelog, independent } = api.config.git

      if (!changelog) {
        return ''
      }

      return generateChangelog({
        cwd: api.cwd,
        independent,
        preset: changelog.preset,
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

    const filename = api.config.git.changelog.filename
    const CHANGELOG_FILE = path.join(api.cwd, filename)

    api.step('Generating changelog ...')

    if (changelog.indexOf('###') === -1) {
      changelog = changelog.replace(new RegExp(EOL, 'g'), '')
      changelog += `${EOL}${EOL}**Note:** No changes, only version bump.`
    }

    if (await isPathExists(CHANGELOG_FILE)) {
      const remain = (await readFile(CHANGELOG_FILE)).trim()
      changelog = remain.length
        ? remain.replace(
            /# Change\s?Log/,
            `# ChangeLog ${EOL}${EOL}${changelog}`,
          )
        : `# ChangeLog ${EOL}${EOL}${changelog}`
    } else {
      changelog = '# ChangeLog ${EOL}${EOL}' + changelog
    }

    await writeFile(CHANGELOG_FILE, changelog)
    logger.ready(`Generated ${filename} successfully.`)

    // const lines = changelog.split(os.EOL)
    // let firstIndex = -1

    // for (let i = 0; i < lines.length; i++) {
    //   const line = lines[i]

    //   if (/^#{1,3}/.test(line)) {
    //     firstIndex = i
    //     break
    //   }
    // }

    // if (firstIndex > -1) {
    //   changelog = changelog.replace(/##* \[([\d.]+)\]/, '## [Changes]')
    // }
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
        const { message } = error as Error
        if (
          (/tag '.+' already exists/.test(message) ||
            /标签 '.+' 已存在/.test(message)) &&
          latestTag === tagName
        ) {
          logger.warn(`Tag ${chalk.bold(tagName)} already exists.`)
        } else {
          throw error
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
