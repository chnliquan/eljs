import type { ReleaseType } from 'semver'

/**
 * 预发布类型
 */
export const prereleaseTypes: ReleaseType[] = [
  'premajor',
  'preminor',
  'prepatch',
  'prerelease',
]

/**
 * 发布类型
 */
export const releaseTypes: ReleaseType[] = ['major', 'minor', 'patch']
