import appRootPath from 'app-root-path'
import path from 'path'
import { isPathExistsSync, readJSONSync } from '../file'

const cache = new Map()

/**
 * 是否是多仓库
 * @param cwd 工作目录
 */
export function isMonorepo(cwd?: string): boolean {
  const cacheKey = `is_monorepo_${cwd}`

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)
  }

  let pkgJSONPath: string

  if (cwd) {
    if (isPathExistsSync(path.join(cwd, 'pnpm-workspace.yaml'))) {
      cache.set(cacheKey, true)
      return true
    }

    pkgJSONPath = path.join(cwd, 'package.json')
  } else {
    if (
      isPathExistsSync(path.join(appRootPath.toString(), 'pnpm-workspace.yaml'))
    ) {
      cache.set(cacheKey, true)
      return true
    }

    pkgJSONPath = path.join(appRootPath.toString(), 'package.json')
  }

  if (pkgJSONPath) {
    const pkgJSON = readJSONSync(pkgJSONPath)
    return Boolean(pkgJSON?.workspaces)
  }

  cache.set(cacheKey, false)
  return false
}
