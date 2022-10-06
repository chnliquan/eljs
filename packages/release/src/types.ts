import conventionalChangelog from 'conventional-changelog'

export type ChangelogConfig = conventionalChangelog.Options['config']

export type PublishTag = 'alpha' | 'beta' | 'next'
export type RepoType = 'github' | 'gitlab'

export interface Options {
  cwd?: string
  tag?: PublishTag
  targetVersion?: string
  gitChecks?: boolean
  registryChecks?: boolean
  ownershipChecks?: boolean
  githubRelease?: boolean
  syncCnpm?: boolean
  latest?: boolean
  repoType?: RepoType
  repoUrl?: string
  changelogPreset?: string

  beforeUpdateVersion?: (version: string) => Promise<void>
  beforeChangelog?: () => Promise<void>
}
