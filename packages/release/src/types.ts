import conventionalChangelog from 'conventional-changelog'

export type ChangelogConfig = conventionalChangelog.Options['config']

export interface Options {
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

export interface Package {
  name: string
  version: string
  private?: boolean
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  publishConfig?: {
    registry: string
  }
  repository?: {
    url: string
  }
}
