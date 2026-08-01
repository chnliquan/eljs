import { isPathExistsSync, type PackageManager } from '@eljs/utils'
import path from 'node:path'
import semver from 'semver'

import type { PackageManagerVariant, ProjectPackageJson } from '../types'

/**
 * 读取 Corepack 兼容的根项目包管理器声明
 *
 * @param projectPkg - 根项目清单
 * @returns 受支持的包管理器名称，声明缺失或无效时返回 `undefined`
 * @internal
 */
export function resolveDeclaredPackageManager(
  projectPkg: ProjectPackageJson,
): PackageManager | undefined {
  const declaration = projectPkg.packageManager

  if (typeof declaration !== 'string') {
    return undefined
  }

  const match = /^(npm|pnpm|yarn|bun)@[^\s]+$/.exec(declaration)
  return match?.[1] as PackageManager | undefined
}

/**
 * 解析发布流程实际需要执行的包管理器命令变体
 *
 * @remarks
 * Yarn 的锁文件名称无法区分 Classic 与 Berry，优先读取 Corepack 的
 * `packageManager` 声明，并以 `.yarnrc.yml` 作为旧项目的兼容信号
 *
 * @param packageManager - 通用工具检测出的包管理器
 * @param cwd - 发布工作目录
 * @param projectPkg - 根项目清单
 * @returns 可直接用于选择发布和锁文件命令的包管理器变体
 * @internal
 */
export function resolvePackageManagerVariant(
  packageManager: PackageManager,
  cwd: string,
  projectPkg: ProjectPackageJson,
): PackageManagerVariant {
  if (packageManager !== 'yarn') {
    return packageManager
  }

  const declaration = projectPkg.packageManager

  if (typeof declaration === 'string' && declaration.startsWith('yarn@')) {
    const version = semver.coerce(declaration.slice('yarn@'.length))

    if (version) {
      return version.major >= 2 ? 'yarn-berry' : 'yarn-classic'
    }

    if (/^yarn@(?:berry|stable)(?:$|[+.-])/i.test(declaration)) {
      return 'yarn-berry'
    }
  }

  return isPathExistsSync(path.join(cwd, '.yarnrc.yml'))
    ? 'yarn-berry'
    : 'yarn-classic'
}
