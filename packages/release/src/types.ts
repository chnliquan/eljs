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
  dry?: boolean
  verbose?: boolean
  latest?: boolean
  onlyPublish?: boolean
  ownershipChecks?: boolean
  syncCnpm?: boolean
  confirm?: boolean
  gitChecks?: boolean
  registryChecks?: boolean
  githubRelease?: boolean
  branch?: string
  tag?: PublishTag
  repoType?: RepoType
  repoUrl?: string
  changelogPreset?: string
  version?: string

  beforeUpdateVersion?: (version: string) => Promise<void>
  beforeChangelog?: () => Promise<void>
}
