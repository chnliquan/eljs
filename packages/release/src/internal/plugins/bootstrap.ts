import type { Api } from '@/types'
import {
  chalk,
  getPackageRootPaths,
  logger,
  readJson,
  type PackageJson,
} from '@eljs/utils'
import path from 'node:path'

export default (api: Api) => {
  api.modifyAppData(async (memo, { cwd }) => {
    const packageRootPaths = await getPackageRootPaths(cwd)

    const pkgJsonPaths: string[] = []
    const pkgs: Required<PackageJson>[] = []
    const pkgNames: string[] = []
    const validPkgRootPaths: string[] = []
    const validPkgNames: string[] = []

    for (const packageRootPath of packageRootPaths) {
      const pkgJsonPath = path.join(packageRootPath, 'package.json')
      const pkg = await readJson<Required<PackageJson>>(pkgJsonPath)

      if (!pkg.name) {
        logger.warn(
          `Detect ${chalk.cyanBright(pkgJsonPath)} has no name field, skipped.`,
        )
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

    return {
      ...memo,
      pkgJsonPaths,
      pkgs,
      pkgNames,
      validPkgRootPaths,
      validPkgNames,
      registry,
    }
  })
}
