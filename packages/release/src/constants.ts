import type { ReleaseType } from 'semver'

/**
 * 预发布类型
 */
export const prereleaseTypes: ReleaseType[] = [
  'prerelease',
  'prepatch',
  'preminor',
  'premajor',
]

/**
 * 发布类型
 */
export const releaseTypes: ReleaseType[] = ['patch', 'minor', 'major']
