export type NpmClient = 'npm' | 'cnpm' | 'tnpm' | 'yarn' | 'pnpm'

export enum NpmClientEnum {
  pnpm = 'pnpm',
  cnpm = 'cnpm',
  yarn = 'yarn',
  npm = 'npm',
}

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
  // eslint-disable-next-line @typescript-eslint/naming-convention
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

/**
 * git 仓库
 */
export interface GitRepo {
  /** 仓库名称 */
  name: string
  /** 仓库所属的组 */
  group: string
  /** 仓库网页地址 */
  href: string
}

/**
 * git 仓库信息
 */
export interface GitInfo extends GitRepo {
  /** 仓库克隆地址 */
  url: string
  /** 仓库当前分支 */
  branch: string
  /** 仓库作者 */
  author: string
  /** 仓库邮箱 */
  email: string
}

export interface Implementor {
  transformSync: (code: string, opts: Record<string, any>) => { code: string }
}

export type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never

export type OmitIndexSignature<ObjectType> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [KeyType in keyof ObjectType as {} extends Record<KeyType, unknown>
    ? never
    : KeyType]: ObjectType[KeyType]
}
