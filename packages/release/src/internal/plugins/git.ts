import type { Api } from '@/types'
import { generateChangelog } from '@/utils'
import {
  gitCommit,
  gitPushCommit,
  gitTag,
  isGitBehindRemote,
  isGitClean,
  isPathExists,
  logger,
  readFile,
  writeFile,
} from '@eljs/utils'
import path from 'node:path'

export default (api: Api) => {
  api.onCheck(async () => {
    if (api.config.git.skipCheck) {
      return
    }

    api.step('Checking git ...')

    if (
      !(await isGitClean({
        cwd: api.cwd,
        verbose: true,
      }))
    ) {
      logger.printErrorAndExit('git is not clean.')
    }

    if (
      await isGitBehindRemote({
        cwd: api.cwd,
        verbose: true,
      })
    ) {
      logger.printErrorAndExit('git is behind remote.')
    }
  })

  api.getChangelog(
    async () => {
      if (!api.config.git.changelog) {
        return ''
      }

      const changelog = await generateChangelog({
        cwd: api.cwd,
        independent: api.config.git.independent,
      })
      return changelog
    },
    {
      stage: 10,
    },
  )

  api.onBeforeRelease(async ({ changelog }) => {
    if (!changelog) {
      return
    }

    const filename = api.config.git.changelog.filename
    const CHANGELOG_FILE = path.join(api.cwd, filename)

    api.step('Generating changelog ...')

    if (changelog.indexOf('###') === -1) {
      changelog = changelog.replace(
        /\n+/g,
        `\n\n**Note:** Version bump only for package ${api.appData.projectPkg.name}`,
      )
    }

    if (await isPathExists(CHANGELOG_FILE)) {
      const remain = (await readFile(CHANGELOG_FILE)).trim()
      changelog = remain.length
        ? remain.replace(/# Change\s?Log/, '# ChangeLog \n\n' + changelog)
        : '# ChangeLog \n\n' + changelog
    } else {
      changelog = '# ChangeLog \n\n' + changelog
    }

    await writeFile(CHANGELOG_FILE, changelog)
    logger.done(`Generated ${filename} successfully.`)

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
    const { independent, push } = api.config.git
    const { pkgNames } = api.appData

    api.step('Committing changes ...')

    const tags = independent
      ? pkgNames.map(pkgName => `${pkgName}@${version}`)
      : [`v${version}`]

    await gitCommit(`chore: bump version v${version}`, {
      cwd: api.cwd,
      verbose: true,
    })

    for await (const tag of tags) {
      await gitTag(tag, {
        cwd: api.cwd,
        verbose: true,
      })
    }

    if (push) {
      await gitPushCommit({
        cwd: api.cwd,
        verbose: true,
      })
    }
  })
}
