import findUp from 'find-up'
import { glob } from 'glob'
import yaml from 'js-yaml'
import path from 'node:path'

import { isPathExists, readFile, readJson } from '../file'
import { getPackageManager } from '../npm'
import type { PackageJson } from '../types'

/**
 * 获取 pnpm 工作目录根路径
 * @param cwd 当前工作目录
 */
export async function getPnpmWorkspaceRoot(cwd: string): Promise<string> {
  const yaml = await findUp(['pnpm-lock.yaml', 'pnpm-workspace.yaml'], {
    cwd,
  })

  return yaml ? path.dirname(yaml) : ''
}

/**
 * 获取 yarn 工作目录根路径
 * @param cwd 当前工作目录
 */
export async function getYarnWorkspaceRoot(cwd: string): Promise<string> {
  const lock = await findUp(['yarn.lock'], {
    cwd,
  })
  return lock ? path.dirname(lock) : ''
}

/**
 * 获取 lerna 工作目录根路径
 * @param cwd 当前工作目录
 */
export async function getLernaWorkspaceRoot(cwd: string): Promise<string> {
  const json = await findUp(['lerna.json'], {
    cwd,
  })
  return json ? path.dirname(json) : ''
}

/**
 * 获取 npm 工作目录根路径
 * @param cwd 当前工作目录
 */
export async function getNpmWorkspaceRoot(cwd: string): Promise<string> {
  const lock = await findUp(['package-lock.json'], {
    cwd,
  })
  return lock ? path.dirname(lock) : ''
}

/**
 * 获取 bun 工作目录根路径
 * @param cwd 当前工作目录
 */
export async function getBunWorkspaceRoot(cwd: string): Promise<string> {
  const lock = await findUp(['bun.lockb'], {
    cwd,
  })
  return lock ? path.dirname(lock) : ''
}

/**
 * 获取工作区根目录
 * @param cwd 当前工作目录
 */
export async function getWorkspaceRoot(cwd: string): Promise<string> {
  return (
    (await getPnpmWorkspaceRoot(cwd)) ||
    (await getYarnWorkspaceRoot(cwd)) ||
    (await getLernaWorkspaceRoot(cwd)) ||
    (await getNpmWorkspaceRoot(cwd))
  )
}

const cache = new Map()

/**
 * 获取项目工作区
 * @param cwd 当前工作目录
 * @param relative 是否展示相对路径
 */
export async function getWorkspaces(
  cwd: string,
  relative = false,
): Promise<string[]> {
  const cacheKey = `pkg_paths_${cwd}`

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)
  }

  const packageManager = await getPackageManager(cwd)
  const packageRootPath: string[] = []
  let workspaces: string[] = []

  if (packageManager === 'pnpm') {
    // pnpm
    const workspacePath = path.resolve(cwd, 'pnpm-workspace.yaml')

    if (await isPathExists(workspacePath)) {
      workspaces = (
        yaml.load(await readFile(workspacePath)) as {
          packages: string[]
        }
      ).packages
    }
  } else {
    // yarn | npm | bun
    const pkgJsonPath = path.resolve(cwd, 'package.json')
    const pkg = await readJson<PackageJson>(pkgJsonPath)
    workspaces = (pkg?.workspaces as string[]) || []
  }

  if (workspaces?.length) {
    for (let matcher of workspaces) {
      matcher = matcher.replace(/\/\*+$/, '/*')

      if (matcher.endsWith('/*')) {
        let rootPath = glob.sync(matcher, {
          cwd,
          ignore: '*/*.*',
        })

        if (!relative) {
          rootPath = rootPath.map(pkgPath => {
            return `${cwd}/${pkgPath}`
          })
        }

        packageRootPath.push(...rootPath)
      } else if (await isPathExists(path.resolve(cwd, matcher))) {
        packageRootPath.push(relative ? matcher : `${cwd}/${matcher}`)
      }
    }
  } else {
    packageRootPath.push(cwd)
  }

  // 缓存结果
  cache.set(cacheKey, packageRootPath)
  return packageRootPath
}
