import conventionalChangelog from 'conventional-changelog'

export type ChangelogConfig = conventionalChangelog.Options['config']

export type PublishTag = 'latest' | 'alpha' | 'beta' | 'next'
export type RepoType = 'github' | 'gitlab'

export type Version =
  | 'major'
  | 'minor'
  | 'patch'
  | 'premajor'
  | 'preminor'
  | 'prepatch'
  | 'prerelease'

export interface Options {
  cwd?: string
  tag?: PublishTag
  gitChecks?: boolean
  registryChecks?: boolean
  ownershipChecks?: boolean
  githubRelease?: boolean
  syncCnpm?: boolean
  latest?: boolean
  repoType?: RepoType
  repoUrl?: string
  changelogPreset?: string
  verbose?: boolean
  dry?: boolean
  version?: string
  confirm?: boolean

  beforeUpdateVersion?: (version: string) => Promise<void>
  beforeChangelog?: () => Promise<void>
}
