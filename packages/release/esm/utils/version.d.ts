import type { PublishTag } from '../types'
export declare function isPrerelease(version: string): boolean
export declare function isAlphaVersion(version: string): boolean
export declare function isRcVersion(version: string): boolean
export declare function isBetaVersion(version: string): boolean
interface RemoteDistTag {
  remoteLatestVersion: string
  remoteAlphaVersion: string
  remoteBetaVersion: string
  remoteNextVersion: string
}
export declare function getDistTag(
  pkgNames: string[],
  cwd: string,
): Promise<RemoteDistTag>
export declare function isVersionExist(
  pkgName: string,
  version: string,
): Promise<boolean>
export declare function getReferenceVersion(
  localVersion: string,
  remoteVersion?: string,
): string
interface Options {
  referenceVersion: string
  targetVersion?: string
  tag?: PublishTag
}
export declare function getVersion(opts: Options): string
export {}
//# sourceMappingURL=version.d.ts.map
