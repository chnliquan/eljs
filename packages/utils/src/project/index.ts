import { isPathExists, readFile, readJson } from '@/file'
import { getPackageManager } from '@/npm'
import type { PackageJson } from '@/types'
import { glob } from 'glob'
import yaml from 'js-yaml'
import path from 'node:path'

const cache = new Map()

/**
 * 获取项目中包含的包路径
 * @param cwd 当前工作目录
 * @param relative 展示相对路径
 */
export async function getPackageRootPaths(
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

  return packageRootPath
}
