import { runCommandLine, type RunCommandOptions } from '@eljs/utils/cp'
import { writeJsonAtomic } from '@eljs/utils/file'
import { logger } from '@eljs/utils/logger'
import type { PackageJson, PackageManager } from '@eljs/utils/types'
import semver from 'semver'

import type { PackageManagerVariant } from '../types'

/**
 * 发布时需要同步内部包版本的依赖字段
 *
 * @internal
 */
type DependencyField =
  | 'dependencies'
  | 'devDependencies'
  | 'optionalDependencies'
  | 'peerDependencies'

/**
 * 更新包版本时的文件写入选项
 */
export interface UpdatePackageVersionOptions {
  /**
   * 是否将修改后的清单写回磁盘
   * @defaultValue `true`
   */
  write?: boolean
}

/**
 * 更新 lock 文件
 *
 * @param packageManager - 包管理工具
 * @param options - 命令执行选项
 * @param variant - 发布流程解析出的包管理器命令变体
 * @returns 锁文件更新完成后兑现的 Promise
 * @throws 当包管理器命令执行失败时抛出
 */
export async function updatePackageLock(
  packageManager: PackageManager,
  options?: RunCommandOptions,
  variant: PackageManagerVariant = packageManager === 'yarn'
    ? 'yarn-classic'
    : packageManager,
): Promise<void> {
  let command: string

  if (packageManager === 'pnpm') {
    command = 'pnpm install --lockfile-only --ignore-scripts'
  } else if (variant === 'yarn-berry') {
    command = 'yarn install --mode=update-lockfile'
  } else if (packageManager === 'yarn') {
    command = 'yarn install --ignore-scripts'
  } else if (packageManager === 'bun') {
    command = 'bun install --lockfile-only --ignore-scripts'
  } else {
    command = 'npm install --package-lock-only --ignore-scripts'
  }

  await runCommandLine(command, { ...options })
}

/**
 * 更新包版本
 * @param pkgJsonPath - package.json 路径
 * @param pkg - package.json 对象
 * @param version - 版本
 * @param pkgNames - 包名
 * @param options - 文件写入选项
 * @returns 清单更新完成后兑现的 Promise
 * @throws 当 workspace 协议无效、依赖范围类型无效或文件写入失败时抛出
 */
export async function updatePackageVersion(
  pkgJsonPath: string,
  pkg: PackageJson,
  version: string,
  pkgNames?: string[],
  options: UpdatePackageVersionOptions = {},
) {
  const { write = true } = options
  pkg.version = version

  if (pkgNames?.length) {
    updatePackageDependencies(pkg, 'dependencies', version, pkgNames)
    updatePackageDependencies(pkg, 'devDependencies', version, pkgNames)
    updatePackageDependencies(pkg, 'optionalDependencies', version, pkgNames)
    updatePackageDependencies(pkg, 'peerDependencies', version, pkgNames)
  }

  if (write) {
    await writeJsonAtomic(pkgJsonPath, pkg)
  }
}

/**
 * 更新包依赖的版本
 * @param pkg - package.json 对象
 * @param type - 依赖类型
 * @param version - 版本
 * @param pkgNames - 包名
 * @returns 无返回值
 * @throws 当 workspace 协议或依赖范围类型无效时抛出
 */
export function updatePackageDependencies(
  pkg: PackageJson,
  type: DependencyField,
  version: string,
  pkgNames: string[],
) {
  const deps = pkg[type]

  if (!deps) {
    return
  }

  Object.entries(deps).forEach(([depName, depValue]) => {
    if (!pkgNames.includes(depName)) {
      return
    }

    if (typeof depValue !== 'string') {
      throw new Error(
        `Invalid dependency version in \`${type}.${depName}\`, expected a string.`,
      )
    }

    const updatedValue = getUpdatedDependencyVersion(depName, depValue, version)
    logger.info(`${pkg.name} -> ${type} -> ${depName}@${version}`)
    deps[depName] = updatedValue
  })
}

function getUpdatedDependencyVersion(
  depName: string,
  depValue: string,
  version: string,
): string {
  const workspacePrefix = 'workspace:'

  if (depValue.startsWith(workspacePrefix)) {
    const workspaceRange = depValue.slice(workspacePrefix.length)

    if (!workspaceRange || /\s/.test(workspaceRange)) {
      throw new Error(
        `Invalid workspace protocol \`${depValue}\` in \`${depName}\`.`,
      )
    }

    if (['*', '^', '~'].includes(workspaceRange)) {
      return depValue
    }

    if (!semver.validRange(workspaceRange)) {
      throw new Error(
        `Invalid workspace protocol \`${depValue}\` in \`${depName}\`.`,
      )
    }

    return `${workspacePrefix}${version}`
  }

  return semver.validRange(depValue) && depValue !== '*' ? version : depValue
}
