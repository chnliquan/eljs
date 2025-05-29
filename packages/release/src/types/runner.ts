import type { PackageJson, PackageManager } from '@eljs/utils'

/**
 * 应用数据
 */
export interface AppData {
  /**
   * 当前 Cli 版本
   */
  cliVersion: string
  /**
   * 仓库源
   */
  registry: string
  /**
   * 当前分支
   */
  branch: string
  /**
   * 最新 tag
   */
  latestTag: string | null
  /**
   * 项目 package.json 路径
   */
  projectPkgJsonPath: string
  /**
   * 项目 package.json 内容
   */
  projectPkg: Required<PackageJson>
  /**
   * 项目中所有包的 package.json 路径
   */
  pkgJsonPaths: string[]
  /**
   * 项目中所有包的 package.json 内容
   */
  pkgs: Required<PackageJson>[]
  /**
   * 项目中的所有包名
   */
  pkgNames: string[]
  /**
   * 项目中可发布包的路径
   */
  validPkgRootPaths: string[]
  /**
   * 项目中可以发布包的名称
   */
  validPkgNames: string[]
  /**
   * 包管理器
   */
  packageManager: PackageManager
  /**
   * 扩展字段
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [property: string]: any
}
