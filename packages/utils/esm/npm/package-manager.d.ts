import type { PackageManager } from '../types'
/**
 * 获取包管理器
 * @param cwd 当前工作目录
 */
export declare function getPackageManager(cwd?: string): Promise<PackageManager>
/**
 * 获取 lock 文件类型
 * @param cwd 当前工作目录
 */
export declare function getTypeofLockFile(
  cwd?: string,
): Promise<PackageManager | null>
//# sourceMappingURL=package-manager.d.ts.map
