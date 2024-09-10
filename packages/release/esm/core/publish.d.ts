import type { PublishTag } from '../types'
export declare function publish(opts: {
  version: string
  publishPkgDirs: string[]
  publishPkgNames: string[]
  cwd?: string
  changelog?: string
  tag?: PublishTag
  gitCheck?: boolean
  repoType: string
  repoUrl?: string
  githubRelease?: boolean
}): Promise<void>
//# sourceMappingURL=publish.d.ts.map
