import {
  chalk,
  isMonorepo,
  isPathExistSync,
  logger,
  PkgJSON,
  readJSONSync,
  run,
} from '@eljs/utils'
import path from 'path'
import { getPkgPaths } from '../utils'

export async function init(cwd: string) {
  const rootPkgJSONPath = path.join(cwd, 'package.json')

  if (!isPathExistSync(rootPkgJSONPath)) {
    logger.printErrorAndExit(
      `unable to find the ${rootPkgJSONPath} file, make sure execute the command in the root directory.`,
    )
  }

  const rootPkgJSON: PkgJSON =
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require(rootPkgJSONPath)

  if (!rootPkgJSON.version) {
    logger.printErrorAndExit(
      `can not read version field in ${rootPkgJSONPath}.`,
    )
  }

  const monorepo = isMonorepo(cwd)
  const pkgJSONPaths: string[] = []
  const pkgJSONs: PkgJSON[] = []
  const pkgNames: string[] = []
  const publishPkgDirs: string[] = []
  const publishPkgNames: string[] = []

  if (monorepo) {
    const pkgPaths = getPkgPaths(cwd)

    try {
      // TODO: support npm yarn workspace
      await run(`pnpm -v`, {
        verbose: false,
      })
    } catch (err) {
      logger.printErrorAndExit(
        'monorepo release depend on `pnpm`, please install `pnpm` first.',
      )
    }

    pkgPaths.forEach(pkgPath => {
      const pkgDir = path.join(cwd, pkgPath)
      const pkgJSONPath = path.join(pkgDir, 'package.json')
      const pkgJSON: PkgJSON = readJSONSync(pkgJSONPath)

      if (!pkgJSON.name) {
        logger.warn(
          `skip publish ${chalk.cyanBright(
            pkgPath,
          )} cause there is no name field the package.json.`,
        )
        return
      } else if (!pkgJSON.version) {
        logger.warn(
          `skip publish ${chalk.cyanBright(
            pkgPath,
          )} cause there is no version field the package.json.`,
        )
      } else {
        pkgJSONPaths.push(pkgJSONPath)
        pkgJSONs.push(pkgJSON)
        pkgNames.push(pkgJSON.name)
      }

      if (!pkgJSON.private) {
        publishPkgDirs.push(pkgDir)
        publishPkgNames.push(pkgJSON.name as string)
      }
    })

    if (publishPkgNames.length === 0) {
      logger.warn(
        `the monorepo ${chalk.bold.cyanBright(cwd)} has no published package.`,
      )
      process.exit(0)
    }
  } else {
    if (rootPkgJSON.private) {
      logger.printErrorAndExit(
        `can not publish private package ${rootPkgJSONPath}.`,
      )
    }

    if (!rootPkgJSON.name) {
      logger.printErrorAndExit(`can not read name field in ${rootPkgJSONPath}.`)
    }

    pkgNames.push(rootPkgJSON.name as string)
    pkgJSONPaths.push(rootPkgJSONPath)
    pkgJSONs.push(rootPkgJSON)
    publishPkgDirs.push(cwd)
    publishPkgNames.push(rootPkgJSON.name as string)
  }

  return {
    rootPkgJSONPath: rootPkgJSONPath,
    rootPkgJSON: rootPkgJSON as Required<PkgJSON>,
    monorepo,
    pkgNames,
    pkgJSONPaths,
    pkgJSONs: pkgJSONs as Required<PkgJSON>[],
    publishPkgDirs,
    publishPkgNames,
  }
}
