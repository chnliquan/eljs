import { chalk, execa, logger } from '@eljs/utils'
import fs from 'fs'
import githubReleaseUrl from 'new-github-release-url'
import open from 'open'
import path from 'path'
import type { DistTag } from '../types'
import {
  isAlphaVersion,
  isBetaVersion,
  isPrerelease,
  isRcVersion,
} from '../utils'

export async function publish(opts: {
  version: string
  publishPkgDirs: string[]
  publishPkgNames: string[]
  cwd?: string
  changelog?: string
  distTag?: DistTag
  gitCheck?: boolean
  repoType: string
  repoUrl?: string
  createRelease?: boolean
}) {
  const {
    version,
    publishPkgDirs,
    publishPkgNames,
    cwd = process.cwd(),
    changelog,
    distTag,
    gitCheck,
    repoType,
    repoUrl,
    createRelease,
  } = opts
  const isPnpm = publishPkgDirs.length > 1
  let resolvedDistTag: DistTag | undefined

  if (distTag) {
    resolvedDistTag = distTag
  } else if (isAlphaVersion(version)) {
    resolvedDistTag = 'alpha'
  } else if (isBetaVersion(version)) {
    resolvedDistTag = 'beta'
  } else if (isRcVersion(version)) {
    resolvedDistTag = 'next'
  }

  const promiseArr = []
  const errors: string[] = []

  for (let i = 0; i < publishPkgDirs.length; i++) {
    const pkgDir = publishPkgDirs[i]
    const pkgName = publishPkgNames[i]

    try {
      promiseArr.push(publishPackage(pkgDir, pkgName, version, resolvedDistTag))
    } catch (error) {
      errors.push(pkgName)
    }
  }

  const settledResults = await Promise.allSettled(promiseArr)

  for (let i = 0; i < settledResults.length; i++) {
    const settledResult = settledResults[i]
    if (settledResult.status === 'rejected') {
      logger.error(
        `Published ${chalk.cyanBright.bold(
          `${publishPkgNames[i]}@${version}`,
        )} failed.`,
      )

      if (settledResult.reason?.message) {
        console.log(`Error: ${settledResult.reason.message}`)
      } else {
        console.log(settledResult.reason)
      }
    }
  }

  // github release
  if (createRelease && repoType === 'github' && repoUrl) {
    let body = ''

    if (changelog) {
      body = changelog
    } else {
      try {
        body = fs.readFileSync(path.join(cwd, 'LATESTLOG.md'), 'utf-8')
      } catch (error) {
        //
      }
    }

    const url = await githubReleaseUrl({
      repoUrl,
      tag: `v${version}`,
      body,
      isPrerelease: isPrerelease(version),
    })

    await open(url)
  }

  async function publishPackage(
    pkgDir: string,
    pkgName: string,
    version: string,
    distTag?: DistTag,
  ) {
    const cmd = isPnpm ? 'pnpm' : 'npm'
    const tag = distTag ? ['--tag', distTag] : []

    const cliArgs = [
      'publish',
      ...tag,
      '--access',
      'public',
      isPnpm && !gitCheck ? '--no-git-checks' : '',
    ].filter(Boolean)

    await execa(cmd, cliArgs, {
      cwd: pkgDir,
    })

    logger.done(
      `Published ${chalk.cyanBright.bold(
        `${pkgName}@${version}`,
      )} successfully.`,
    )
  }
}
