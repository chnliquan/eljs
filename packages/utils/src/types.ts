export interface Repo {
  href: string
  group: string
  project: string
}

export interface GitInfo extends Repo {
  url: string
  branch: string
}

export interface SpinOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args?: any[]
  successText?: string
  failText?: string
}

export interface ChangelogOptions {
  changelog?: string
  latestLog?: string
  basedir?: string
}
