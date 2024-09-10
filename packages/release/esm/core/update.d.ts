import { type PkgJSON } from '@eljs/utils'
export declare function updateLock(cwd: string): Promise<void>
export declare function updateVersions(opts: {
  rootPkgJSONPath: string
  rootPkgJSON: Required<PkgJSON>
  pkgNames: string[]
  pkgJSONPaths: string[]
  pkgJSONs: Required<PkgJSON>[]
  version: string
}): void
export declare function updatePackage(opts: {
  pkgJSONPath: string
  pkgJSON: PkgJSON
  version: string
  pkgNames?: string[]
}): void
export declare function updateDeps(opts: {
  pkgJSON: PkgJSON
  version: string
  depType: 'dependencies' | 'peerDependencies'
  pkgNames: string[]
}): void
//# sourceMappingURL=update.d.ts.map
