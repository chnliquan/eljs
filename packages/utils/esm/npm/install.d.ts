import type { PackageManager } from '../types'
/**
 * 安装依赖选项
 */
export interface InstallDepsOpts {
  /**
   * 运行时依赖
   */
  dependencies?: string[]
  /**
   * 开发时依赖
   */
  devDependencies?: string[]
  /**
   * 当前工作目录
   */
  cwd?: string
}
/**
 * 安装指定依赖
 * @param opts 安装依赖选项
 */
export declare function installDeps(opts: InstallDepsOpts): Promise<void>
/**
 * 安装项目依赖
 * @param cwd 当前工作目录
 * @param packageManager 包管理器
 */
export declare function install(
  cwd?: string,
  packageManager?: PackageManager,
): Promise<void>
//# sourceMappingURL=install.d.ts.map
