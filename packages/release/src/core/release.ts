import {
  chalk,
  isGitBehindRemote,
  isGitBranch,
  isGitClean,
  logger,
} from '@eljs/utils'
import path from 'path'

import type { Options } from '../types'
import { getBumpVersion, step } from '../utils'
import { generateChangelog } from './changelog'
import { commit } from './commit'
import { init } from './init'
import { checkOwnership } from './ownership'
import { publish } from './publish'
import { reconfirm } from './reconfirm'
import { checkRegistry } from './registry'
import { sync } from './sync'
import { updateLock, updateVersions } from './update'

/**
 * Workflow
 *
 * 1. Make changes
 * 2. Commit those changes
 * 3. Make sure Travis turns green
 * 4. Bump version in package.json
 * 5. conventionalChangelog
 * 6. Commit package.json and CHANGELOG.md files
 * 7. Tag
 * 8. Push
 */
export async function release(opts: Options): Promise<void> {
  const {
    cwd = process.cwd(),
    dry = false,
    verbose = false,
    latest = true,
    publishOnly = false,
    syncCnpm = false,
    confirm = true,
    registryCheck = true,
    ownershipCheck = true,
    gitCheck = true,
    gitPush = true,
    githubRelease = true,
    branch = '',
    tag,
    repoType: customRepoType,
    changelogPreset = '@eljs/changelog-preset',
    version,
    beforeUpdateVersion,
    beforeChangelog,
  } = opts

  // check git status
  if (gitCheck) {
    step('Checking git ...')
    if (!(await isGitClean())) {
      logger.printErrorAndExit('git is not clean.')
    }

    if (await isGitBehindRemote()) {
      logger.printErrorAndExit('git is behind remote.')
    }
  }

  // check branch
  if (branch) {
    step('Checking branch ...')
    if (!(await isGitBranch(branch))) {
      logger.printErrorAndExit(
        `current branch does not match branch ${branch}.`,
      )
    }
  }

  const {
    rootPkgJSONPath,
    rootPkgJSON,
    pkgNames,
    pkgJSONPaths,
    pkgJSONs,
    publishPkgDirs,
    publishPkgNames,
  } = await init(cwd)

  const repoUrl = rootPkgJSON?.repository?.url || ''
  const repoType =
    customRepoType || (repoUrl?.includes('github') ? 'github' : 'gitlab')

  // check registry
  if (registryCheck && !dry) {
    step('Checking registry ...')
    await checkRegistry({
      repoType,
      repoUrl,
      pkgRegistry: rootPkgJSON?.publishConfig?.registry,
    })
  }

  // check ownership
  if (ownershipCheck && !dry) {
    step('Checking npm ownership ...')
    await checkOwnership(publishPkgNames)
  }

  if (dry) {
    console.log()
    console.log(
      chalk.cyanBright.bold(`Running in ${publishPkgNames.length} packages`),
    )
    const maxPadLength = publishPkgNames
      .slice()
      .sort((a, b) => b.length - a.length)[0].length
    console.log(`${'PackageName'.padEnd(maxPadLength)} Path`)

    publishPkgNames.forEach((pkgName, index) =>
      console.log(
        `${pkgName.padEnd(maxPadLength)} ${path.relative(
          cwd,
          publishPkgDirs[index],
        )}`,
      ),
    )
    return
  }

  let bumpVersion = rootPkgJSON.version
  let changelog = ''

  if (!publishOnly) {
    // bump version
    step('Bump version ...')
    bumpVersion = await getBumpVersion({
      pkgJSON: rootPkgJSON,
      publishPkgNames,
      tag,
      targetVersion: version,
    })

    if (confirm) {
      bumpVersion = await reconfirm({
        bumpVersion,
        publishPkgNames,
        pkgJSON: rootPkgJSON,
        tag,
        verbose,
      })
    }

    if (typeof beforeUpdateVersion === 'function') {
      await beforeUpdateVersion(bumpVersion)
    }

    // update all package versions and inter-dependencies

    step('Updating versions ...')
    await updateVersions({
      rootPkgJSONPath,
      rootPkgJSON,
      pkgNames,
      pkgJSONPaths,
      pkgJSONs,
      version: bumpVersion,
    })

    // update pnpm-lock.yaml or package-lock.json

    step('Updating lockfile...')
    await updateLock(cwd)

    if (typeof beforeChangelog === 'function') {
      await beforeChangelog()
    }

    // generate changelog

    step(`Generating changelog ...`)
    changelog = await generateChangelog({
      changelogPreset: changelogPreset as string,
      latest,
      pkgName: rootPkgJSON.name as string,
      cwd,
    })

    // commit git changes
    step('Committing changes ...')
    await commit(bumpVersion, gitPush)
  }

  // publish package
  step(`Publishing package ...`)
  await publish({
    version: bumpVersion,
    publishPkgDirs,
    publishPkgNames,
    cwd,
    tag,
    gitCheck,
    changelog,
    repoType,
    repoUrl,
    githubRelease,
  })

  // sync cnpm
  if (syncCnpm) {
    step('Sync cnpm ...')
    await sync(publishPkgNames)
  }
}
