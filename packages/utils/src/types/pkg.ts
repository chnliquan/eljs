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
 * PackageJson 类型
 */
export interface PackageJson {
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
