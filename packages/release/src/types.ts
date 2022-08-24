import conventionalChangelog from 'conventional-changelog'

export type ChangelogConfig = conventionalChangelog.Options['config']

export interface Options {
  cwd?: string
  repoType?: 'github' | 'gitlab'
  repoUrl?: string
  latest?: boolean
  changelogPreset?: string
  checkGitStatus?: boolean
  targetVersion?: string

  beforeUpdateVersion?: (version: string) => Promise<void>
  beforeChangelog?: () => Promise<void>
}

export interface Workspace {
  [key: string]: string[]
}
