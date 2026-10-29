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
 * @remarks 锁文件按目录距离优先，同一目录仍按 pnpm、yarn、bun、npm 的顺序选择
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
  const roots = await Promise.all([
    getPnpmWorkspaceRoot(cwd),
    getYarnWorkspaceRoot(cwd),
    getBunWorkspaceRoot(cwd),
    getNpmWorkspaceRoot(cwd),
  ])

  const managers = ['pnpm', 'yarn', 'bun', 'npm'] as const
  // 查找结果均为 cwd 的祖先绝对路径，路径越长越近；稳定排序保留同目录优先级
  const candidates = roots
    .map((root, index) => ({ root, manager: managers[index] }))
    .filter(candidate => candidate.root)
    .sort((left, right) => right.root.length - left.root.length)

  return candidates[0]?.manager ?? null
}
