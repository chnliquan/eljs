import { resolve } from 'path'

import { hasGlobalInstallation } from '../env'
import { existsSync } from '../file'
import { PackageManager } from '../types'

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

  const [hasYarn, hasPnpm, hasBun] = await Promise.all([
    hasGlobalInstallation('yarn'),
    hasGlobalInstallation('pnpm'),
    hasGlobalInstallation('bun'),
  ])

  if (hasYarn) {
    return 'yarn'
  }

  if (hasPnpm) {
    return 'pnpm'
  }

  if (hasBun) {
    return 'bun'
  }

  return 'npm'
}

/**
 * 获取 lock 文件类型
 * @param cwd 当前工作目录
 */
export function getTypeofLockFile(
  cwd = process.cwd(),
): Promise<PackageManager | null> {
  const key = `has_lockfile_${cwd}`

  if (cache.has(key)) {
    return Promise.resolve(cache.get(key))
  }

  return Promise.all([
    existsSync(resolve(cwd, 'yarn.lock')),
    existsSync(resolve(cwd, 'pnpm-lock.yaml')),
    existsSync(resolve(cwd, 'bun.lockb')),
    existsSync(resolve(cwd, 'package-lock.json')),
  ]).then(([isYarn, isPnpm, isBun, isNpm]) => {
    let value: PackageManager | null = null

    if (isYarn) {
      value = 'yarn'
    } else if (isPnpm) {
      value = 'pnpm'
    } else if (isBun) {
      value = 'bun'
    } else if (isNpm) {
      value = 'npm'
    }

    cache.set(key, value)
    return value
  })
}
