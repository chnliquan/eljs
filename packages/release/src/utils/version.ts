import type { DistTag, PrereleaseId } from '@/types'
import { chalk, getGitCommitSha, logger, run } from '@eljs/utils'
import semver, { RELEASE_TYPES, SemVer, type ReleaseType } from 'semver'

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
 * 版本号是否合法
 * @param version 版本
 * @param releaseType 是否可以是 releaseType
 */
export function isVersionValid(
  version: string,
  releaseType: boolean = false,
): boolean {
  if (releaseType) {
    if (RELEASE_TYPES.includes(version as ReleaseType)) {
      return true
    }
  }

  if (semver.valid(version)) {
    return true
  }

  return false
}

/**
 * 解析版本
 * @param version 版本
 */
export function parseVersion(version: string) {
  const parsed = semver.parse(version) as SemVer
  const isPrerelease = Boolean(parsed.prerelease?.length)
  const prereleaseId = (
    isPrerelease && isNaN(parsed.prerelease[0] as number)
      ? parsed.prerelease[0]
      : null
  ) as PrereleaseId | null

  return {
    version: version.toString(),
    isPrerelease,
    prereleaseId,
  }
}

/**
 * 版本是否存在
 * @param pkgName 包名
 * @param version 版本
 */
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

/**
 * 获取稳定版本
 * @param version 版本
 */
export function getStableVersion(version: string) {
  const prerelease = semver.prerelease(version)

  if (prerelease) {
    return semver.clean(
      version.replace(`-${prerelease.join('.')}`, ''),
    ) as string
  }

  return version
}

export function getReferenceVersion(
  localVersion: string,
  remoteVersion: string,
  distTag: DistTag,
): string {
  if (!remoteVersion) {
    return localVersion
  }

  const referenceVersion = semver.gt(remoteVersion, localVersion)
    ? remoteVersion
    : localVersion

  switch (distTag) {
    case 'latest':
      return referenceVersion
    case 'alpha':
    case 'beta':
    case 'rc': {
      const stableLocalVersion = getStableVersion(localVersion)
      const stableRemoteVersion = getStableVersion(remoteVersion)
      return stableLocalVersion === stableRemoteVersion
        ? remoteVersion
        : referenceVersion
    }
  }
}

/**
 * 获取最大的版本
 * @param versions 版本
 */
export function getMaxVersion(...versions: string[]) {
  return versions.reduce((maxVersion: string, version: string) => {
    if (!version) {
      return maxVersion
    }

    return semver.gt(maxVersion, version) ? maxVersion : version
  })
}

/**
 * 获取发布版本
 * @param referenceVersion 基准版本
 * @param releaseType 发布版本
 * @param prereleaseId 预发布 ID
 */
export function getReleaseVersion(
  referenceVersion: string,
  releaseType: ReleaseType,
  prereleaseId?: PrereleaseId,
) {
  switch (releaseType) {
    case 'major':
    case 'minor':
    case 'patch':
      return semver.inc(referenceVersion, releaseType) as string
    case 'premajor':
    case 'preminor':
    case 'prepatch':
    case 'prerelease':
      return semver.inc(
        referenceVersion,
        releaseType,
        prereleaseId || 'beta',
      ) as string
    default:
      break
  }

  return referenceVersion
}

/**
 *
 * @param referenceVersion 基准版本
 * @param cwd 当前工作目录
 */
export async function getCanaryVersion(
  referenceVersion: string,
  cwd: string = process.cwd(),
) {
  const date = new Date()
  const yyyy = date.getUTCFullYear()
  const MM = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const dateStamp = `${yyyy}${MM}${dd}`
  const sha = await getGitCommitSha(true, {
    cwd,
  })
  const stableVersion = getStableVersion(referenceVersion)
  const nextVersion =
    isAlphaVersion(referenceVersion) ||
    isBetaVersion(referenceVersion) ||
    isCanaryVersion(referenceVersion)
      ? stableVersion
      : semver.inc(stableVersion, 'patch')
  return `${nextVersion}-canary.${dateStamp}-${sha}`
}
