/**
 * 预发布版本
 */
export type PrereleaseId = 'alpha' | 'beta' | 'rc'

/**
 * npm dist tag
 */
export type DistTag = PrereleaseId | 'latest'
