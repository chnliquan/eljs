import { glob } from 'glob'
import * as yaml from 'js-yaml'
import path from 'node:path'

import { pathExists, readFile, readJson } from '../file'
import { getPackageManager } from '../npm/package-manager'
import type { PackageJson } from '../types'
import {
  getBunWorkspaceRoot,
  getLernaWorkspaceRoot,
  getNpmWorkspaceRoot,
  getPnpmWorkspaceRoot,
  getYarnWorkspaceRoot,
} from './workspace-lock'

const workspaceCache = new Map<string, string[]>()

export {
  getBunWorkspaceRoot,
  getLernaWorkspaceRoot,
  getNpmWorkspaceRoot,
  getPnpmWorkspaceRoot,
  getYarnWorkspaceRoot,
} from './workspace-lock'

/**
 * 清除工作区目录解析缓存
 *
 * @remarks
 * 仅用于测试隔离，不通过 path 公共入口导出
 *
 * @internal
 */
export function clearWorkspaceCache(): void {
  workspaceCache.clear()
}

/**
 * 获取工作区根目录
 *
 * @param cwd - 当前工作目录
 * @returns 最近的受支持工作区根目录，未找到时返回空字符串
 */
export async function getWorkspaceRoot(cwd: string): Promise<string> {
  return (
    (await getPnpmWorkspaceRoot(cwd)) ||
    (await getYarnWorkspaceRoot(cwd)) ||
    (await getLernaWorkspaceRoot(cwd)) ||
    (await getBunWorkspaceRoot(cwd)) ||
    (await getNpmWorkspaceRoot(cwd))
  )
}

/**
 * 获取工作区包根目录
 * @param cwd - 当前工作目录
 * @param relative - 是否展示相对路径
 * @returns 匹配的包根目录列表
 */
export async function getWorkspacePackageRoots(
  cwd: string,
  relative = false,
): Promise<string[]> {
  const resolvedCwd = path.resolve(cwd)
  const cacheKey = `pkg_paths_${resolvedCwd}_${relative ? 'relative' : 'absolute'}`

  const cachedWorkspaces = workspaceCache.get(cacheKey)

  if (cachedWorkspaces) {
    return cachedWorkspaces
  }

  const packageManager = await getPackageManager(resolvedCwd)
  const packageRootPath: string[] = []
  let workspaces: string[] = []

  if (packageManager === 'pnpm') {
    // pnpm
    const workspacePath = path.resolve(resolvedCwd, 'pnpm-workspace.yaml')

    if (await pathExists(workspacePath)) {
      workspaces = (
        yaml.load(await readFile(workspacePath)) as {
          packages: string[]
        }
      ).packages
    }
  } else {
    // yarn | npm | bun
    const pkgJsonPath = path.resolve(resolvedCwd, 'package.json')
    const pkg = await readJson<PackageJson>(pkgJsonPath)
    workspaces = (pkg?.workspaces as string[]) || []
  }

  if (workspaces?.length) {
    for (let matcher of workspaces) {
      matcher = matcher.replace(/\/\*+$/, '/*')

      if (matcher.endsWith('/*')) {
        let rootPath = glob.sync(matcher, {
          cwd: resolvedCwd,
          ignore: '*/*.*',
        })

        if (!relative) {
          rootPath = rootPath.map(pkgPath => {
            return path.join(resolvedCwd, pkgPath)
          })
        }

        packageRootPath.push(...rootPath)
      } else if (await pathExists(path.resolve(resolvedCwd, matcher))) {
        packageRootPath.push(
          relative ? matcher : path.join(resolvedCwd, matcher),
        )
      }
    }
  } else {
    packageRootPath.push(relative ? '.' : resolvedCwd)
  }

  // 缓存结果
  workspaceCache.set(cacheKey, packageRootPath)
  return packageRootPath
}

/**
 * 获取工作区包根目录
 * @param cwd - 当前工作目录
 * @param relative - 是否展示相对路径
 * @returns 匹配的包根目录列表
 * @deprecated 请改用 {@link getWorkspacePackageRoots}
 */
export function getWorkspaces(
  cwd: string,
  relative = false,
): Promise<string[]> {
  return getWorkspacePackageRoots(cwd, relative)
}
