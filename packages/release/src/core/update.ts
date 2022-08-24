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
  rootDir: string
  version: string
  pkgPaths: string[]
}) {
  const { rootDir, version, pkgPaths } = opts

  const rootPkgJSONPath = path.join(rootDir, 'package.json')
  const rootPkgJSON = readJSONSync(rootPkgJSONPath)

  // 1. update root package.json
  updatePackage({
    pkgJSONPath: rootPkgJSONPath,
    pkgJSON: rootPkgJSON,
    version,
  })

  const publishPkgDirs: string[] = []

  // 2. update all packages with monorepo
  if (pkgPaths.length > 0) {
    const pkgJSONPaths: string[] = []
    const pkgJSONs: PkgJSON[] = []
    const pkgNames: string[] = []

    pkgPaths.forEach(pkgPath => {
      const pkgDir = path.join(rootDir, pkgPath)
      const pkgJSONPath = path.join(pkgDir, 'package.json')
      const pkgJSON: PkgJSON = readJSONSync(pkgJSONPath)
      pkgJSONPaths.push(pkgJSONPath)
      pkgJSONs.push(pkgJSON)
      pkgNames.push(pkgJSON.name as string)

      if (!pkgJSON.private) {
        publishPkgDirs.push(pkgDir)
      }
    })

    pkgPaths.forEach((_, index) => {
      updatePackage({
        pkgJSONPath: pkgJSONPaths[index],
        pkgJSON: pkgJSONs[index],
        pkgNames,
        version,
      })
    })

    return publishPkgDirs
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

  Object.keys(deps).forEach(dep => {
    if (pkgNames.includes(dep)) {
      logger.info(`${pkgJSON.name} -> ${depType} -> ${dep}@${version}`)
      deps[dep] = deps[dep].replace(reg, version)
    }
  })
}
