import type { Preid } from '@/types'
import {
  isAlphaVersion,
  isBetaVersion,
  isCanaryVersion,
  isPrerelease,
  isRcVersion,
} from '@/utils'
import { chalk, execa, logger } from '@eljs/utils'
import fs from 'fs'
import githubReleaseUrl from 'new-github-release-url'
import open from 'open'
import path from 'path'

export async function publish(opts: {
  registry: string
  version: string
  publishPkgDirs: string[]
  publishPkgNames: string[]
  cwd?: string
  changelog?: string
  preid?: Preid
  gitCheck?: boolean
  createRelease?: boolean
  repositoryUrl?: string
}) {
  const {
    registry,
    version,
    publishPkgDirs,
    publishPkgNames,
    cwd = process.cwd(),
    changelog,
    preid,
    gitCheck,
    createRelease,
    repositoryUrl,
  } = opts
  // TODO：支持 yarn
  const isPnpm = publishPkgDirs.length > 1
  let distTag = ''

  if (preid) {
    distTag = preid
  } else if (isAlphaVersion(version)) {
    distTag = 'alpha'
  } else if (isBetaVersion(version)) {
    distTag = 'beta'
  } else if (isRcVersion(version)) {
    distTag = 'rc'
  } else if (isCanaryVersion(version)) {
    distTag = 'canary'
  }

  const promiseArr = []
  const errors: string[] = []

  for (let i = 0; i < publishPkgDirs.length; i++) {
    const pkgDir = publishPkgDirs[i]
    const pkgName = publishPkgNames[i]

    try {
      promiseArr.push(
        publishPackage(pkgDir, pkgName, version, registry, distTag),
      )
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
  if (createRelease && repositoryUrl) {
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
      repoUrl: repositoryUrl,
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
    registry: string,
    distTag?: string,
  ) {
    // TODO：支持 yarn
    const cmd = isPnpm ? 'pnpm' : 'npm'
    const tag = distTag ? ['--tag', distTag] : []

    const cliArgs = [
      'publish',
      '--registry',
      registry,
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
