import { chalk } from '@eljs/utils'
import path from 'path'

import { getBumpVersion } from '../prompt'
import { Options } from '../types'
import { step } from '../utils'
import { generateChangelog } from './changelog'
import { commit } from './commit'
import { branchCheck, gitCheck } from './git'
import { init } from './init'
import { ownershipCheck } from './ownership'
import { publish } from './publish'
import { reconfirm } from './reconfirm'
import { registryCheck } from './registry'
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
    gitChecks = true,
    branch,
    verbose = false,
    dry = false,
    confirm = true,
    onlyPublish = false,
  } = opts

  // check git status
  if (gitChecks) {
    await gitCheck()
  }

  // check branch
  if (branch) {
    await branchCheck(branch)
  }

  const {
    rootPkgJSONPath,
    rootPkgJSON,
    monorepo,
    pkgNames,
    pkgJSONPaths,
    pkgJSONs,
    publishPkgDirs,
    publishPkgNames,
  } = await init(cwd)

  const defaultOptions: Options = {
    registryChecks: true,
    ownershipChecks: false,
    syncCnpm: false,
    repoUrl: rootPkgJSON?.repository?.url || '',
    changelogPreset: '@eljs/changelog-preset',
    latest: true,
    githubRelease: true,
  }

  const {
    version,
    registryChecks,
    ownershipChecks,
    tag,
    syncCnpm,
    repoType: customRepoType,
    repoUrl,
    changelogPreset,
    latest,
    githubRelease,
    beforeUpdateVersion,
    beforeChangelog,
  } = Object.assign(defaultOptions, opts)

  const repoType =
    customRepoType || (repoUrl?.includes('github') ? 'github' : 'gitlab')

  // check registry
  if (registryChecks && !dry) {
    await registryCheck({
      repoType,
      repoUrl,
      pkgRegistry: rootPkgJSON?.publishConfig?.registry,
    })
  }

  // check ownership
  if (ownershipChecks && !dry) {
    await ownershipCheck(publishPkgNames)
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

  if (!onlyPublish) {
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
      monorepo,
      pkgNames,
      pkgJSONPaths,
      pkgJSONs,
      version: bumpVersion,
    })

    // update pnpm-lock.yaml or package-lock.json
    step('Updating lockfile...')
    await updateLock({
      monorepo,
      version: bumpVersion,
      rootDir: cwd,
    })

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
    await commit(bumpVersion)
  }

  // publish package
  await publish({
    version: bumpVersion,
    publishPkgDirs,
    publishPkgNames,
    cwd,
    tag,
    gitChecks,
    changelog,
    repoType,
    repoUrl,
    githubRelease,
  })

  // sync cnpm
  if (syncCnpm) {
    await sync(publishPkgNames)
  }
}
