import { hasGlobalInstallation } from '../env'
import {
  getNpmWorkspaceRoot,
  getPnpmWorkspaceRoot,
  getYarnWorkspaceRoot,
} from '../path'
import type { PackageManager } from '../types'

const cache = new Map()

/**
 * 获取包管理器
 * @param cwd 当前工作目录
 */
export async function getPackageManager(
  cwd = process.cwd(),
): Promise<PackageManager> {
  const type = await getTypeofLockFile(cwd)

  if (type) {
    return type
  }

  const [hasPnpm, hasYarn] = await Promise.all([
    hasGlobalInstallation('pnpm'),
    hasGlobalInstallation('yarn'),
  ])

  if (hasPnpm) {
    return 'pnpm'
  }

  if (hasYarn) {
    return 'yarn'
  }

  return 'npm'
}

/**
 * 获取 lock 文件类型
 * @param cwd 当前工作目录
 */
export async function getTypeofLockFile(
  cwd = process.cwd(),
): Promise<PackageManager | null> {
  const key = `has_lockfile_${cwd}`

  if (cache.has(key)) {
    return Promise.resolve(cache.get(key))
  }

  return Promise.all([
    getPnpmWorkspaceRoot(cwd),
    getYarnWorkspaceRoot(cwd),
    getNpmWorkspaceRoot(cwd),
  ]).then(([isPnpm, isYarn, isNpm]) => {
    let value: PackageManager | null = null

    if (isPnpm) {
      value = 'pnpm'
    } else if (isYarn) {
      value = 'yarn'
    } else if (isNpm) {
      value = 'npm'
    }

    cache.set(key, value)
    return value
  })
}
