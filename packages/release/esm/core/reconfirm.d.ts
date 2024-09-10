import { type PkgJSON } from '@eljs/utils'
import type { PublishTag } from '../types'
export interface ReconfirmOpts {
  cwd: string
  bumpVersion: string
  publishPkgNames: string[]
  pkgJSON: Required<PkgJSON>
  tag?: PublishTag
  verbose?: boolean
}
export declare function reconfirm(opts: ReconfirmOpts): Promise<string>
//# sourceMappingURL=reconfirm.d.ts.map
