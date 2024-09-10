import { glob } from 'glob'
import yaml from 'js-yaml'
import path from 'path'

import { isPathExists, isPathExistsSync, readFile, readJSON } from '@/file'
import { getPackageManager } from '@/npm'
import type { PkgJSON } from '@/types'

const cache = new Map()

/**
 * 获取指定目录包含的包路径
 * @param cwd 工作目录
 * @param relative 是否展示相对路径
 */
export async function getPkgPaths(
  cwd = process.cwd(),
  relative = false,
): Promise<string[]> {
  const cacheKey = `pkg_paths_${cwd}`

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)
  }

  const packageManager = await getPackageManager(cwd)
  const pkgPaths: string[] = []
  let workspaces: string[] = []

  try {
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
      const pkgJSONPath = path.resolve(cwd, 'package.json')
      const pkgJSON = await readJSON<PkgJSON>(pkgJSONPath)
      workspaces = (pkgJSON.workspaces as string[]) || []
    }

    if (workspaces?.length > 0) {
      workspaces.forEach(matcher => {
        matcher = matcher.replace(/\/\*+$/, '/*')

        if (matcher.endsWith('/*')) {
          let currentPkgPaths = glob.sync(matcher, {
            cwd,
            ignore: '*/*.*',
          })

          if (!relative) {
            currentPkgPaths = currentPkgPaths.map(pkgPath => {
              return `${cwd}/${pkgPath}`
            })
          }

          pkgPaths.push(...currentPkgPaths)
        } else if (isPathExistsSync(path.resolve(cwd, matcher))) {
          pkgPaths.push(relative ? matcher : `${cwd}/${matcher}`)
        }
      })
    } else {
      pkgPaths.push(cwd)
    }
  } catch (err) {
    // ...
  }

  return pkgPaths
}
