/**
 * 包管理器枚举
 */
export declare enum PackageManagerEnum {
  npm = 'npm',
  yarn = 'yarn',
  pnpm = 'pnpm',
  bun = 'bun',
}
/**
 * 包管理器
 */
export type PackageManager = `${PackageManagerEnum}`
/**
 * PackageJSON 信息
 */
export interface PkgJSON {
  name?: string
  version?: string
  private?: boolean
  description?: string
  repository?: {
    type: string
    url: string
  }
  license?: string
  author?: string
  main?: string
  module?: string
  browser?: string
  types?: string
  files?: string[]
  scripts?: Record<string, string>
  'lint-staged'?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  publishConfig?: {
    registry: string
  }
  engines?: {
    node: string
    [properName: string]: string
  }
  workspaces?: string[]
  [propName: string]: any
}
export type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never
export type OmitIndexSignature<ObjectType> = {
  [KeyType in keyof ObjectType as {} extends Record<KeyType, unknown>
    ? never
    : KeyType]: ObjectType[KeyType]
}
//# sourceMappingURL=index.d.ts.map
