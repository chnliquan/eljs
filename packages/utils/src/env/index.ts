import appRootPath from 'app-root-path'
import execa from 'execa'
import path from 'path'
import { existsSync, readJSONSync } from '../file'

const cache = new Map()

/**
 * 命令是否全局安装
 * @param bin 全局命令
 */
export function hasGlobalInstallation(bin: string): Promise<boolean> {
  const cacheKey = `has_global_${bin}`

  if (cache.has(cacheKey)) {
    return Promise.resolve(cache.get(cacheKey))
  }

  return execa(bin, ['--version'])
    .then(data => {
      return /^\d+.\d+.\d+$/.test(data.stdout)
    })
    .then(value => {
      cache.set(cacheKey, value)
      return value
    })
    .catch(() => false)
}

/**
 * 是否是多仓库
 * @param cwd 当前工作目录
 */
export function isMonorepo(cwd?: string): boolean {
  let pkgJSONPath: string

  if (cwd) {
    if (existsSync(path.join(cwd, 'pnpm-workspace.yaml'))) {
      return true
    }

    pkgJSONPath = path.join(cwd, 'package.json')
  } else {
    if (existsSync(path.join(appRootPath.toString(), 'pnpm-workspace.yaml'))) {
      return true
    }

    pkgJSONPath = path.join(appRootPath.toString(), 'package.json')
  }

  if (pkgJSONPath) {
    const pkgJSON = readJSONSync(pkgJSONPath)
    return Boolean(pkgJSON?.workspaces)
  }

  return false
}
