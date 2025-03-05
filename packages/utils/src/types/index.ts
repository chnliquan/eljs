/**
 * 包管理器枚举
 */
export enum PackageManagerEnum {
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
  keywords?: string[]
  homepage?: string
  bugs?: {
    url: string
  }
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
  bin?: Record<string, string> | string
  files?: string[]
  scripts?: Record<string, string>
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'lint-staged'?: Record<string, string | string[]>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  publishConfig?: {
    registry: string
    [properName: string]: string
  }
  engines?: {
    [properName: string]: string
  }
  workspaces?: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [propName: string]: any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never

export type OmitIndexSignature<ObjectType> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [KeyType in keyof ObjectType as {} extends Record<KeyType, unknown>
    ? never
    : KeyType]: ObjectType[KeyType]
}
