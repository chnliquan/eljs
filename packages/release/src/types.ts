import conventionalChangelog from 'conventional-changelog'

export type ChangelogConfig = conventionalChangelog.Options['config']

export interface Options {
  cwd?: string
  targetVersion?: string
  gitChecks?: boolean
  syncCnpm?: boolean
  repoType?: 'github' | 'gitlab'
  repoUrl?: string
  changelogPreset?: string
  latest?: boolean

  beforeUpdateVersion?: (version: string) => Promise<void>
  beforeChangelog?: () => Promise<void>
}
