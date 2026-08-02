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

export {
  getBunWorkspaceRoot,
  getLernaWorkspaceRoot,
  getNpmWorkspaceRoot,
  getPnpmWorkspaceRoot,
  getYarnWorkspaceRoot,
} from './workspace-lock'

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
 * @throws {@link TypeError} 工作区配置不是字符串数组或 `{ packages: string[] }` 时抛出
 */
export async function getWorkspacePackageRoots(
  cwd: string,
  relative = false,
): Promise<string[]> {
  const resolvedCwd = path.resolve(cwd)
  const packageManager = await getPackageManager(resolvedCwd)
  let workspacePatterns: string[] = []

  if (packageManager === 'pnpm') {
    const workspacePath = path.resolve(resolvedCwd, 'pnpm-workspace.yaml')

    if (await pathExists(workspacePath)) {
      const workspaceConfig = yaml.load(await readFile(workspacePath))
      workspacePatterns = normalizeWorkspacePatterns(
        isRecord(workspaceConfig) ? workspaceConfig.packages : workspaceConfig,
        workspacePath,
      )
    }
  } else {
    const pkgJsonPath = path.resolve(resolvedCwd, 'package.json')
    const pkg = await readJson<PackageJson>(pkgJsonPath)
    workspacePatterns = normalizeWorkspacePatterns(pkg?.workspaces, pkgJsonPath)
  }

  if (workspacePatterns.length === 0) {
    return [relative ? '.' : resolvedCwd]
  }

  const ignoredPatterns = workspacePatterns
    .filter(pattern => pattern.startsWith('!'))
    .map(pattern => normalizeWorkspacePattern(pattern.slice(1)))
  const packageRoots = new Set<string>()

  for (const pattern of workspacePatterns) {
    if (pattern.startsWith('!')) {
      continue
    }

    const matches = glob.sync(normalizeWorkspacePattern(pattern), {
      cwd: resolvedCwd,
      ignore: ['*/*.*', ...ignoredPatterns],
    })

    for (const match of matches) {
      packageRoots.add(relative ? match : path.resolve(resolvedCwd, match))
    }
  }

  return [...packageRoots]
}

function normalizeWorkspacePatterns(
  value: unknown,
  sourcePath: string,
): string[] {
  let patterns: unknown = value

  if (isRecord(value)) {
    patterns = value.packages
  }

  if (patterns === undefined) {
    return []
  }

  if (
    !Array.isArray(patterns) ||
    patterns.some(pattern => typeof pattern !== 'string' || !pattern.trim())
  ) {
    throw new TypeError(
      `Invalid workspace configuration in ${sourcePath}: expected a non-empty string array or { packages: string[] }`,
    )
  }

  return patterns
}

function normalizeWorkspacePattern(pattern: string): string {
  return pattern.replace(/\/\*+$/u, '/*')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
