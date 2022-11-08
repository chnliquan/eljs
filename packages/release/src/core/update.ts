import { logger, PkgJSON, readJSONSync, run } from '@eljs/utils'
import fs from 'fs'
import path from 'path'

export async function updateLock(opts: {
  isMonorepo: boolean
  rootDir: string
  version: string
}) {
  const { isMonorepo, rootDir, version } = opts

  if (isMonorepo) {
    await run(`pnpm install --prefer-offline`)
    return
  }

  const pkgLockJSONPath = path.resolve(rootDir, 'package-lock.json')

  if (!fs.existsSync(pkgLockJSONPath)) {
    return
  }

  const pkgJSON: PkgJSON = readJSONSync(pkgLockJSONPath)
  pkgJSON.version = version

  fs.writeFileSync(pkgLockJSONPath, JSON.stringify(pkgJSON, null, 2) + '\n')
}

export function updateVersions(opts: {
  rootPkgJSONPath: string
  rootPkgJSON: Required<PkgJSON>
  isMonorepo: boolean
  pkgNames: string[]
  pkgJSONPaths: string[]
  pkgJSONs: Required<PkgJSON>[]
  version: string
}) {
  const {
    rootPkgJSONPath,
    rootPkgJSON,
    isMonorepo,
    pkgNames,
    pkgJSONPaths,
    pkgJSONs,
    version,
  } = opts

  // 1. update root package.json
  updatePackage({
    pkgJSONPath: rootPkgJSONPath,
    pkgJSON: rootPkgJSON,
    version,
  })

  // 2. update all packages with monorepo
  if (isMonorepo) {
    pkgNames.forEach((_, index) => {
      updatePackage({
        pkgJSONPath: pkgJSONPaths[index],
        pkgJSON: pkgJSONs[index],
        pkgNames,
        version,
      })
    })
  }
}

export function updatePackage(opts: {
  pkgJSONPath: string
  pkgJSON: PkgJSON
  version: string
  pkgNames?: string[]
}) {
  const { pkgJSONPath, pkgJSON, version, pkgNames } = opts

  pkgJSON.version = version

  if (pkgNames) {
    updateDeps({
      pkgJSON,
      version,
      depType: 'dependencies',
      pkgNames,
    })
    updateDeps({
      pkgJSON,
      version,
      depType: 'peerDependencies',
      pkgNames,
    })
  }

  fs.writeFileSync(pkgJSONPath, JSON.stringify(pkgJSON, null, 2) + '\n')
}

export function updateDeps(opts: {
  pkgJSON: PkgJSON
  version: string
  depType: 'dependencies' | 'peerDependencies'
  pkgNames: string[]
}) {
  const { pkgJSON, version, depType, pkgNames } = opts
  const deps = pkgJSON[depType]

  if (!deps) {
    return
  }

  const reg = /\^?(\d+\.\d+\.\d+)(-(alpha|beta|next)\.\d+)?/

  Object.entries(deps).forEach(([depName, depValue]) => {
    if (pkgNames.includes(depName)) {
      if (
        depValue.startsWith('workspace') &&
        !/^workspace:[^\s]+/.test(depValue)
      ) {
        logger.printErrorAndExit(
          `the workspace protocol ${depName} in ${pkgJSON.name} dependencies is not valid.`,
        )
      }

      logger.info(`${pkgJSON.name} -> ${depType} -> ${depName}@${version}`)
      deps[depName] = deps[depName].replace(reg, version)
    }
  })
}
