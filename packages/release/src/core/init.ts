import {
  chalk,
  getPkgPaths,
  isPathExists,
  logger,
  readJson,
  readJsonSync,
  type PackageJson,
} from '@eljs/utils'
import path from 'path'

export async function init(cwd: string) {
  const rootPackageJsonPath = path.join(cwd, 'package.json')

  if (!(await isPathExists(rootPackageJsonPath))) {
    logger.printErrorAndExit(
      `Detect ${chalk.bold.cyanBright(cwd)} has no package.json.`,
    )
  }

  const rootPackageJson: PackageJson = await readJson(rootPackageJsonPath)

  if (!rootPackageJson.version) {
    logger.printErrorAndExit(
      `Detect ${chalk.bold.cyanBright(rootPackageJsonPath)} has no version field.`,
    )
  }

  const pkgJSONPaths: string[] = []
  const pkgJSONs: PackageJson[] = []
  const pkgNames: string[] = []
  const publishPkgDirs: string[] = []
  const publishPkgNames: string[] = []

  const pkgPaths = await getPkgPaths(cwd)

  pkgPaths.forEach(pkgPath => {
    const pkgJSONPath = path.join(pkgPath, 'package.json')
    const pkgJSON: PackageJson = readJsonSync(pkgJSONPath)

    if (!pkgJSON.name) {
      logger.warn(
        `Detect ${chalk.cyanBright(pkgJSONPath)} has no name field, skipped.`,
      )
      return
    }

    if (!pkgJSON.private) {
      publishPkgDirs.push(pkgPath)
      publishPkgNames.push(pkgJSON.name as string)
    }

    pkgJSONPaths.push(pkgJSONPath)
    pkgJSONs.push(pkgJSON)
    pkgNames.push(pkgJSON.name)
  })

  if (publishPkgNames.length === 0) {
    logger.warn(
      `Detect ${chalk.bold.cyanBright(
        cwd,
      )} has no available package to publish.`,
    )
    process.exit(0)
  }

  return {
    rootPackageJsonPath: rootPackageJsonPath,
    rootPackageJson: rootPackageJson as Required<PackageJson>,
    pkgNames,
    pkgJSONPaths,
    pkgJSONs: pkgJSONs as Required<PackageJson>[],
    publishPkgDirs,
    publishPkgNames,
  }
}
