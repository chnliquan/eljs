import { getGitCommitSha, run } from '@eljs/utils'
import semver, { type ReleaseType } from 'semver'
import type { DistTag, PrereleaseId } from '../types'

const { RELEASE_TYPES } = semver

/**
 * 判断版本是否为任意语义化预发布版本
 *
 * @param version - 待判断版本
 * @returns 是否包含预发布段
 */
export function isPrerelease(version: string): boolean {
  return Boolean(semver.prerelease(version))
}

/**
 * 判断版本是否使用 alpha 预发布标识
 *
 * @param version - 待判断版本
 * @returns 是否为 alpha 版本
 */
export function isAlphaVersion(version: string): boolean {
  return hasPrereleaseId(version, 'alpha')
}

/**
 * 判断版本是否使用 beta 预发布标识
 *
 * @param version - 待判断版本
 * @returns 是否为 beta 版本
 */
export function isBetaVersion(version: string): boolean {
  return hasPrereleaseId(version, 'beta')
}

/**
 * 判断版本是否使用 rc 预发布标识
 *
 * @param version - 待判断版本
 * @returns 是否为 rc 版本
 */
export function isRcVersion(version: string): boolean {
  return hasPrereleaseId(version, 'rc')
}

/**
 * 判断版本是否使用 canary 预发布标识
 *
 * @param version - 待判断版本
 * @returns 是否为 canary 版本
 */
export function isCanaryVersion(version: string): boolean {
  return hasPrereleaseId(version, 'canary')
}

/**
 * 判断版本号或发布类型是否合法
 *
 * @param version - 版本
 * @param releaseType - 是否可以是 releaseType
 * @returns 是否合法
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
 * 解析并规范化语义化版本
 *
 * @param version - 版本
 * @returns 规范化版本、预发布状态和预发布标识
 * @throws 当版本不符合语义化版本规范时抛出
 */
export function parseVersion(version: string) {
  const parsed = semver.parse(version)

  if (!parsed) {
    throw new Error(`Invalid semantic version \`${version}\`.`)
  }

  const isPrerelease = Boolean(parsed.prerelease.length)
  const prereleaseId =
    isPrerelease && isNaN(parsed.prerelease[0] as number)
      ? String(parsed.prerelease[0])
      : null

  return {
    version: parsed.version,
    isPrerelease,
    prereleaseId,
  }
}

/**
 * 查询 npm 仓库中是否已存在指定版本
 *
 * @param pkgName - 包名
 * @param version - 版本
 * @param registry - 源仓库
 * @param cwd - 用于读取项目级 npm 配置的工作目录
 * @returns 版本是否存在
 * @throws 当查询因网络、鉴权或服务端异常失败时抛出
 */
export async function isVersionExist(
  pkgName: string,
  version: string,
  registry?: string,
  cwd?: string,
) {
  try {
    const registryArg = registry ? ['--registry', registry] : []
    const cliArgs = ['view', `${pkgName}@${version}`, ...registryArg].filter(
      Boolean,
    )
    const result = cwd
      ? await run('npm', cliArgs, { cwd })
      : await run('npm', cliArgs)
    const remote = result.stdout.replace(/\W*/, '').trim()
    if (!remote) {
      return false
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (
      /\bE404\b/i.test(message) ||
      /404 Not Found/i.test(message) ||
      /is not in this registry/i.test(message) ||
      /No match found for version/i.test(message)
    ) {
      return false
    }

    throw error
  }

  return true
}

/**
 * 获取去除预发布段和构建元数据后的稳定版本
 *
 * @param version - 版本
 * @returns 稳定版本；无效输入保持原值
 */
export function getStableVersion(version: string) {
  const parsed = semver.parse(version)

  if (parsed?.prerelease.length) {
    return `${parsed.major}.${parsed.minor}.${parsed.patch}`
  }

  return version
}

function hasPrereleaseId(version: string, prereleaseId: string): boolean {
  return semver.prerelease(version)?.[0] === prereleaseId
}

/**
 * 获取基准版本
 *
 * @param localVersion - 本地版本
 * @param remoteVersion - 远程版本
 * @param distTag - npm tag
 * @returns 根据 dist-tag 规则选择的本地或远程基准版本
 */
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
    default:
      return referenceVersion
  }
}

/**
 * 获取参数中的最高语义化版本
 *
 * @param versions - 版本
 * @returns 最高版本；没有有效参数时返回空字符串
 */
export function getMaxVersion(...versions: Array<string | undefined>) {
  return versions.reduce((maxVersion: string, version) => {
    if (!version) {
      return maxVersion
    }

    if (!maxVersion) {
      return version
    }

    return semver.gt(maxVersion, version) ? maxVersion : version
  }, '')
}

/**
 * 获取发布版本
 *
 * @param referenceVersion - 基准版本
 * @param releaseType - 发布版本
 * @param prereleaseId - 预发布 id
 * @returns 按升级类型计算的版本；未知升级类型保持基准版本
 * @throws 当基准版本或预发布标识无法生成合法语义化版本时抛出
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
      return incrementVersion(referenceVersion, releaseType)
    case 'premajor':
    case 'preminor':
    case 'prepatch':
    case 'prerelease':
      return incrementVersion(
        referenceVersion,
        releaseType,
        prereleaseId || 'beta',
      )
    default:
      break
  }

  return referenceVersion
}

/**
 * 基于当前提交生成 canary 版本
 *
 * @param referenceVersion - 基准版本
 * @param cwd - 当前工作目录
 * @returns 追加 canary 标识、时间戳和提交哈希的版本
 * @throws 当基准版本无效或 Git 提交哈希读取失败时抛出
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
      : incrementVersion(stableVersion, 'patch')
  return `${nextVersion}-canary.${dateStamp}-${sha}`
}

/**
 * 将 semver 无法计算版本时的 `null` 转换为可定位的异常
 *
 * @internal
 */
function incrementVersion(
  referenceVersion: string,
  releaseType: ReleaseType,
  prereleaseId?: string,
): string {
  const version = prereleaseId
    ? semver.inc(referenceVersion, releaseType, prereleaseId)
    : semver.inc(referenceVersion, releaseType)

  if (!version) {
    throw new Error(
      `Unable to increment semantic version \`${referenceVersion}\` with release type \`${releaseType}\`${
        prereleaseId ? ` and prerelease identifier \`${prereleaseId}\`` : ''
      }.`,
    )
  }

  return version
}
