import { hasGlobalInstallation } from '../env'
import {
  getBunWorkspaceRoot,
  getNpmWorkspaceRoot,
  getPnpmWorkspaceRoot,
  getYarnWorkspaceRoot,
} from '../path/workspace-lock'
import type { PackageManager } from '../types'

/**
 * 获取包管理器
 *
 * @param cwd - 当前工作目录
 * @returns 由最近的锁文件或全局安装状态推断出的包管理器
 * @throws 当锁文件查找或全局命令检测失败时传播原始错误
 */
export async function getPackageManager(
  cwd = process.cwd(),
): Promise<PackageManager> {
  const type = await detectLockfilePackageManager(cwd)

  if (type) {
    return type
  }

  const [hasPnpm, hasYarn, hasBun] = await Promise.all([
    hasGlobalInstallation('pnpm'),
    hasGlobalInstallation('yarn'),
    hasGlobalInstallation('bun'),
  ])

  if (hasPnpm) {
    return 'pnpm'
  }

  if (hasYarn) {
    return 'yarn'
  }

  if (hasBun) {
    return 'bun'
  }

  return 'npm'
}

/**
 * 获取 lock 文件类型
 *
 * @param cwd - 当前工作目录
 * @returns 最近锁文件对应的包管理器，没有锁文件时返回 `null`
 * @throws 当锁文件查找失败时传播原始错误
 * @internal
 */
async function detectLockfilePackageManager(
  cwd = process.cwd(),
): Promise<PackageManager | null> {
  const [isPnpm, isYarn, isBun, isNpm] = await Promise.all([
    getPnpmWorkspaceRoot(cwd),
    getYarnWorkspaceRoot(cwd),
    getBunWorkspaceRoot(cwd),
    getNpmWorkspaceRoot(cwd),
  ])

  if (isPnpm) {
    return 'pnpm'
  }

  if (isYarn) {
    return 'yarn'
  }

  if (isBun) {
    return 'bun'
  }

  if (isNpm) {
    return 'npm'
  }

  return null
}
