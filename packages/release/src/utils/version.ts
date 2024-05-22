import { chalk, getNpmDistTag, logger, run } from '@eljs/utils'
import semver from 'semver'
import { PublishTag } from '../types'

export function isPrerelease(version: string): boolean {
  return (
    isAlphaVersion(version) || isBetaVersion(version) || isRcVersion(version)
  )
}

export function isAlphaVersion(version: string): boolean {
  return version.includes('-alpha.')
}

export function isRcVersion(version: string): boolean {
  return version.includes('-rc.')
}

export function isBetaVersion(version: string): boolean {
  return version.includes('-beta.')
}

export async function getDistTag(pkgNames: string[]) {
  for (let i = 0; i < pkgNames.length; i++) {
    const pkgName = pkgNames[i]

    try {
      const distTag = await getNpmDistTag(pkgName)

      return {
        remoteLatestVersion: distTag['latest'],
        remoteAlphaVersion: distTag['alpha'],
        remoteBetaVersion: distTag['beta'],
        remoteNextVersion: distTag['next'],
      }
    } catch (err: any) {
      if (err.message.includes('command not found')) {
        logger.error(
          `Please make sure the ${chalk.cyanBright.bold(
            'npm',
          )} has been installed.`,
        )
        process.exit(1)
      } else {
        // logger.info(
        //   `This package ${chalk.cyanBright.bold(
        //     pkgName,
        //   )} has never been released, this is the first release.`,
        // )
        console.log()
      }
    }
  }

  return {
    remoteLatestVersion: '',
    remoteAlphaVersion: '',
    remoteBetaVersion: '',
    remoteNextVersion: '',
  }
}

export async function isVersionExist(pkgName: string, version: string) {
  try {
    const remoteInfo = (
      await run(`npm view ${pkgName}@${version} version`, {
        verbose: false,
      })
    ).stdout.replace(/\W*/, '')

    if (remoteInfo.trim() === '') {
      return false
    }
  } catch (err: any) {
    if (err.message.includes('command not found')) {
      logger.error(
        `Please make sure the ${chalk.cyanBright.bold(
          'npm',
        )} has been installed`,
      )
      process.exit(1)
    } else {
      logger.info(
        `This package ${chalk.cyanBright.bold(
          pkgName,
        )} has never been released, this is the first release.`,
      )
      console.log()
      return false
    }
  }

  return true
}

export function getReferenceVersion(
  localVersion: string,
  remoteVersion?: string,
): string {
  if (!remoteVersion) {
    return localVersion
  }

  const baseRemoteVersion = remoteVersion.split('-')[0]
  const baseLocalVersion = localVersion.split('-')[0]

  if (
    (isAlphaVersion(remoteVersion) && isBetaVersion(localVersion)) ||
    ((isBetaVersion(remoteVersion) || isAlphaVersion(remoteVersion)) &&
      isRcVersion(localVersion))
  ) {
    if (baseRemoteVersion === baseLocalVersion) {
      return remoteVersion
    }
  }

  return semver.gt(remoteVersion, localVersion) ? remoteVersion : localVersion
}

interface Options {
  referenceVersion: string
  targetVersion?: string
  tag?: PublishTag
}

export function getVersion(opts: Options) {
  const { referenceVersion, targetVersion, tag } = opts

  switch (targetVersion) {
    case 'major':
    case 'minor':
    case 'patch':
      return semver.inc(referenceVersion, targetVersion) as string
    case 'premajor':
    case 'preminor':
    case 'prepatch':
    case 'prerelease':
      if (!tag || tag === 'latest') {
        logger.printErrorAndExit(
          `Bump ${targetVersion} version should pass tag option.`,
        )
      }
      return semver.inc(
        referenceVersion,
        targetVersion,
        tag === 'next' ? 'rc' : tag,
      ) as string
    default:
      break
  }

  return referenceVersion
}
