import { runCommandLine, type RunCommandOptions } from '@eljs/utils/cp'
import { writeJsonAtomic } from '@eljs/utils/file'
import { logger } from '@eljs/utils/logger'
import type { PackageJson, PackageManager } from '@eljs/utils/types'
import path from 'node:path'
import semver from 'semver'

import { resolveWorkspaceReference } from '../internal/workspace-reference'
import type { PackageManagerVariant, WorkspacePackage } from '../types'

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
 * 依赖更新时解析相对 workspace 引用的目录上下文
 *
 * @remarks 目录映射必须完整且唯一，未提供时拒绝相对引用而不猜测目标包
 */
export interface PackageDependencyContext {
  /** 当前消费包的根目录 */
  rootPath?: string
  /** 已加载的工作区包及其目录 */
  workspacePackages?: readonly WorkspacePackage[]
}

/**
 * 更新包版本时的文件写入选项
 */
export interface UpdatePackageVersionOptions {
  /**
   * 是否将修改后的清单写回磁盘
   * @defaultValue `true`
   */
  write?: boolean
  /**
   * 相对 workspace 引用的完整目录映射
   *
   * @remarks 不提供映射时允许具名引用，但拒绝相对引用
   */
  workspacePackages?: readonly WorkspacePackage[]
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
 * @param pkgNames - 完整工作区包名，省略时仅更新包自身版本
 * @param options - 文件写入及 workspace 目录解析选项
 * @returns 清单更新完成后兑现的 Promise
 * @throws 当 workspace 协议无效、目标无法安全解析、依赖范围类型无效或文件写入失败时抛出
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
    const referenceContext = {
      rootPath: path.dirname(pkgJsonPath),
      workspacePackages: options.workspacePackages,
    }
    updatePackageDependencies(
      pkg,
      'dependencies',
      version,
      pkgNames,
      referenceContext,
    )
    updatePackageDependencies(
      pkg,
      'devDependencies',
      version,
      pkgNames,
      referenceContext,
    )
    updatePackageDependencies(
      pkg,
      'optionalDependencies',
      version,
      pkgNames,
      referenceContext,
    )
    updatePackageDependencies(
      pkg,
      'peerDependencies',
      version,
      pkgNames,
      referenceContext,
    )
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
 * @param pkgNames - 完整工作区包名，用于解析直接依赖和 workspace 别名目标
 * @param referenceContext - 相对 workspace 引用的目录映射
 * @returns 无返回值
 * @remarks workspace 别名保留目标名前缀，相对引用及 `*`、`^`、`~` 占位范围保持原样
 * @throws 当 workspace 协议、目标映射或依赖范围类型无效时抛出
 */
export function updatePackageDependencies(
  pkg: PackageJson,
  type: DependencyField,
  version: string,
  pkgNames: string[],
  referenceContext: PackageDependencyContext = {},
) {
  const deps = pkg[type]

  if (!deps) {
    return
  }

  Object.entries(deps).forEach(([depName, depValue]) => {
    if (
      !pkgNames.includes(depName) &&
      !(typeof depValue === 'string' && depValue.startsWith('workspace:'))
    ) {
      return
    }

    if (typeof depValue !== 'string') {
      throw new Error(
        `Invalid dependency version in \`${type}.${depName}\`, expected a string.`,
      )
    }

    const reference = resolveWorkspaceReference(depName, depValue, {
      rootPath: referenceContext.rootPath,
      packages: referenceContext.workspacePackages,
      packageNames: pkgNames,
    })
    if (!reference) return
    const updatedValue =
      reference.relative || ['*', '^', '~'].includes(reference.range)
        ? depValue
        : reference.prefix
          ? `${reference.prefix}${version}`
          : semver.validRange(depValue) && depValue !== '*'
            ? version
            : depValue
    logger.info(`${pkg.name} -> ${type} -> ${depName}@${version}`)
    deps[depName] = updatedValue
  })
}
