import conventionalChangelog from 'conventional-changelog'

export type ChangelogConfig = conventionalChangelog.Options['config']

export interface Options {
  cwd?: string
  gitChecks?: boolean
  targetVersion?: string
  repoType?: 'github' | 'gitlab'
  repoUrl?: string
  latest?: boolean
  changelogPreset?: string

  beforeUpdateVersion?: (version: string) => Promise<void>
  beforeChangelog?: () => Promise<void>
}
