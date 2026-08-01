import type { PackageManager } from '../types'

/**
 * 包管理器锁文件检测缓存，键包含调用目录且 `null` 表示已确认不存在锁文件
 * @internal
 */
export const packageManagerCache = new Map<string, PackageManager | null>()

/**
 * 清除包管理器锁文件检测缓存，仅供测试和显式生命周期重置使用
 * @internal
 */
export function clearPackageManagerCache(): void {
  packageManagerCache.clear()
}
