import { type PkgJSON } from '@eljs/utils'
import type { PublishTag } from '../types'
export declare function getBumpVersion(opts: {
  cwd: string
  pkgJSON: Required<PkgJSON>
  publishPkgNames: string[]
  tag?: PublishTag
  targetVersion?: string
}): Promise<string>
//# sourceMappingURL=prompt.d.ts.map
