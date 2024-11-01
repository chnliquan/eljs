import type { Preid } from '@/types'
import {
  chalk,
  getGitCommitShortSha,
  getNpmDistTag,
  logger,
  run,
  timeout,
} from '@eljs/utils'
import semver, { type ReleaseType } from 'semver'

export function isPrerelease(version: string): boolean {
  return (
    isAlphaVersion(version) ||
    isBetaVersion(version) ||
    isRcVersion(version) ||
    isCanaryVersion(version)
  )
}

export function isAlphaVersion(version: string): boolean {
  return version.includes('-alpha.')
}

export function isBetaVersion(version: string): boolean {
  return version.includes('-beta.')
}

export function isRcVersion(version: string): boolean {
  return version.includes('-rc.')
}

export function isCanaryVersion(version: string): boolean {
  return version.includes('-canary.')
}
/**
 * 远程 NPM dist tag
 */
export interface RemoteDistTag {
  latest: string
  alpha: string
  beta: string
  rc: string
}

export async function getRemoteDistTag(
  pkgNames: string[],
  cwd: string,
): Promise<RemoteDistTag> {
  try {
    const distTag = await timeout(
      (async () => {
        for (let i = 0; i < pkgNames.length; i++) {
          const pkgName = pkgNames[i]

          try {
            const distTag = await getNpmDistTag(pkgName, {
              cwd,
            })

            return {
              latest: distTag['latest'],
              alpha: distTag['alpha'],
              beta: distTag['beta'],
              rc: distTag['rc'],
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
          latest: '',
          alpha: '',
          beta: '',
          rc: '',
        }
      })(),
      pkgNames.length * 2000,
    )
    return distTag
  } catch (err) {
    return {
      latest: '',
      alpha: '',
      beta: '',
      rc: '',
    }
  }
}

export async function isVersionExist(pkgName: string, version: string) {
  try {
    const remoteInfo = (
      await run('npm', ['view', `${pkgName}@${version}`, version], {
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
    const {
      major = '0',
      minor = '0',
      patch = '0',
    } = semver.parse(localVersion) || {}
    return `${major}.${minor}.${patch}`
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
  releaseType?: ReleaseType
  preid?: Preid
}

export function getReleaseVersion(opts: Options) {
  const { referenceVersion, releaseType, preid = 'alpha' } = opts

  switch (releaseType) {
    case 'major':
    case 'minor':
    case 'patch':
      return semver.inc(referenceVersion, releaseType) as string
    case 'premajor':
    case 'preminor':
    case 'prepatch':
    case 'prerelease':
      return semver.inc(referenceVersion, releaseType, preid) as string
    default:
      break
  }

  return referenceVersion
}

export async function getCanaryVersion(referenceVersion: string, cwd: string) {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const sha = await getGitCommitShortSha(cwd)
  return `${referenceVersion}-canary.${year}${month}${day}+${sha}`
}
