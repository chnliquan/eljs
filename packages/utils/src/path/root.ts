import { glob } from 'glob'
import * as yaml from 'js-yaml'
import path from 'node:path'

import { pathExists, readFile, readJson } from '../file'
import { findUp } from '../module/find-up'
import { getPackageManager } from '../npm/package-manager'
import type { PackageJson } from '../types'

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
 * @remarks 从当前目录逐级向上查找，不因包管理器不同而跳过更近的根目录
 * @param cwd - 当前工作目录
 * @returns 最近的受支持工作区根目录，未找到时返回空字符串
 */
export async function getWorkspaceRoot(cwd: string): Promise<string> {
  const marker = await findUp(
    [
      'pnpm-workspace.yaml',
      'pnpm-lock.yaml',
      'yarn.lock',
      'lerna.json',
      'bun.lock',
      'bun.lockb',
      'package-lock.json',
    ],
    { cwd },
  )
  return marker ? path.dirname(marker) : ''
}

/**
 * 获取工作区包根目录
 * @remarks 保留 glob 的递归与排除语义，仅返回含 package.json 的目录并排除 node_modules；未配置工作区时返回 cwd
 * @param cwd - 工作区配置所在目录
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
    .map(pattern => `${pattern.slice(1).replace(/\/+$/u, '')}/**`)
  const packageRoots = new Set<string>()

  for (const pattern of workspacePatterns) {
    if (pattern.startsWith('!')) {
      continue
    }

    const matches = await glob(`${pattern.replace(/\/+$/u, '')}/package.json`, {
      cwd: resolvedCwd,
      dot: true,
      nodir: true,
      ignore: ['**/node_modules/**', ...ignoredPatterns],
    })

    for (const match of matches.sort()) {
      const directory = path.dirname(match)
      packageRoots.add(
        relative ? directory : path.resolve(resolvedCwd, directory),
      )
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
