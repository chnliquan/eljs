import { chalk, logger, run } from '@eljs/utils'
import semver from 'semver'

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
  let remoteLatestVersion = ''
  let remoteAlphaVersion = ''
  let remoteBetaVersion = ''
  let remoteNextVersion = ''

  for (let i = 0; i < pkgNames.length; i++) {
    const pkgName = pkgNames[i]

    try {
      const distTags = (
        await run(`npm dist-tag ${pkgName}`, {
          verbose: false,
        })
      ).stdout.split('\n')

      // 翻转数组，保证先解析到 latest
      distTags.reverse().forEach(tag => {
        const version = tag.split(': ')[1]

        if (tag.startsWith('latest')) {
          remoteLatestVersion = version
        }

        if (tag.startsWith('alpha')) {
          remoteAlphaVersion = version
        }

        if (tag.startsWith('beta')) {
          remoteBetaVersion = version
        }

        if (tag.startsWith('next')) {
          remoteNextVersion = version
        }
      })

      return {
        remoteLatestVersion,
        remoteAlphaVersion,
        remoteBetaVersion,
        remoteNextVersion,
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
    remoteLatestVersion,
    remoteAlphaVersion,
    remoteBetaVersion,
    remoteNextVersion,
  }
}

export async function isVersionExist(pkgName: string, version: string) {
  try {
    const remoteInfo = (
      await run(`npm view ${pkgName}@${version} version`)
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
