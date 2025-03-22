import type { Api } from '@/types'
import { AppError } from '@/utils'
import {
  getGitBranch,
  getGitLatestTag,
  getWorkspaces,
  isPathExists,
  logger,
  readJson,
  type PackageJson,
} from '@eljs/utils'
import path from 'node:path'

export default (api: Api) => {
  api.modifyAppData(async (memo, { cwd }) => {
    const packageRootPaths = await getWorkspaces(cwd)

    const pkgJsonPaths: string[] = []
    const pkgs: Required<PackageJson>[] = []
    const pkgNames: string[] = []
    const validPkgRootPaths: string[] = []
    const validPkgNames: string[] = []

    for (const packageRootPath of packageRootPaths) {
      const pkgJsonPath = path.join(packageRootPath, 'package.json')

      if (!(await isPathExists(pkgJsonPath))) {
        continue
      }

      const pkg = await readJson<Required<PackageJson>>(pkgJsonPath)

      if (!pkg.name) {
        logger.warn(`No name field was found in ${pkgJsonPath}, skipped.`)
        continue
      }

      if (!pkg.private) {
        validPkgRootPaths.push(packageRootPath)
        validPkgNames.push(pkg.name as string)
      }

      pkgJsonPaths.push(pkgJsonPath)
      pkgs.push(pkg)
      pkgNames.push(pkg.name)
    }

    const registry = memo.projectPkg?.publishConfig?.registry
    const branch = await getGitBranch({
      cwd,
    })
    const latestTag = await getGitLatestTag({
      cwd,
    })

    if (validPkgNames.length === 0) {
      throw new AppError(`No valid package to publish in ${cwd}.`)
    }

    return {
      ...memo,
      pkgJsonPaths,
      pkgs,
      pkgNames,
      validPkgRootPaths,
      validPkgNames,
      registry,
      branch,
      latestTag,
    }
  })
}
