import {
  chalk,
  getPkgPaths,
  isPathExists,
  logger,
  readJSON,
  readJSONSync,
  type PkgJSON,
} from '@eljs/utils'
import path from 'path'

export async function init(cwd: string) {
  const rootPkgJSONPath = path.join(cwd, 'package.json')

  if (!(await isPathExists(rootPkgJSONPath))) {
    logger.printErrorAndExit(
      `Detect ${chalk.bold.cyanBright(cwd)} has no package.json.`,
    )
  }

  const rootPkgJSON: PkgJSON = await readJSON(rootPkgJSONPath)

  if (!rootPkgJSON.version) {
    logger.printErrorAndExit(
      `Detect ${chalk.bold.cyanBright(rootPkgJSONPath)} has no version field.`,
    )
  }

  const pkgJSONPaths: string[] = []
  const pkgJSONs: PkgJSON[] = []
  const pkgNames: string[] = []
  const publishPkgDirs: string[] = []
  const publishPkgNames: string[] = []

  const pkgPaths = await getPkgPaths(cwd)

  pkgPaths.forEach(pkgPath => {
    const pkgJSONPath = path.join(pkgPath, 'package.json')
    const pkgJSON: PkgJSON = readJSONSync(pkgJSONPath)

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
    rootPkgJSONPath: rootPkgJSONPath,
    rootPkgJSON: rootPkgJSON as Required<PkgJSON>,
    pkgNames,
    pkgJSONPaths,
    pkgJSONs: pkgJSONs as Required<PkgJSON>[],
    publishPkgDirs,
    publishPkgNames,
  }
}
