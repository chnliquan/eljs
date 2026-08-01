/**
 * npm 预发布标识
 *
 * @remarks
 * 内置常用标识并允许使用项目自定义标识
 * 配置值必须是可安全用作 npm dist-tag 的单段非数字 semver 标识
 */
export type PrereleaseId = 'alpha' | 'beta' | 'rc' | 'next' | (string & {})

/**
 * npm 发布使用的 dist-tag
 */
export type DistTag = PrereleaseId | 'latest'
