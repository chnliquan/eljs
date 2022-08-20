import { logger } from '@eljs/utils'
import fs from 'fs'
import path from 'path'
import { Package, Workspace } from './types'

export interface Packages {
  [key: string]: string[]
}

export function updateVersions(
  rootName: string,
  version: string,
  workspace: Workspace,
): string[] {
  // 1. update root package.json
  updatePackage({
    rootName,
    pkgDir: process.cwd(),
    version,
  })

  // 2. update package-lock.json if exist
  updatePackageLock({
    rootName,
    pkgDir: process.cwd(),
    version,
  })

  // 3. update all packages with monorepo
  if (Object.keys(workspace).length > 0) {
    // TODO：duplicate pkg name
    const allPackages = Object.keys(workspace).reduce((prev, dir) => {
      const packages = workspace[dir]
      return prev.concat(packages)
    }, [] as string[])

    const pkgDirs: string[] = []

    Object.keys(workspace).forEach(dir => {
      const packages = workspace[dir]
      packages.forEach(pkg => {
        const pkgDir = path.resolve(process.cwd(), dir, pkg)

        pkgDirs.push(pkgDir)
        updatePackage({
          rootName,
          pkgDir,
          version,
          packages: allPackages,
        })
      })
    })

    return pkgDirs
  }

  return []
}

interface UpdatePackageParams {
  rootName: string
  pkgDir: string
  version: string
  packages?: string[]
}

export function updatePackage({
  rootName,
  pkgDir,
  version,
  packages,
}: UpdatePackageParams) {
  const pkgJSONPath = path.resolve(pkgDir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgJSONPath, 'utf-8'))
  pkg.version = version

  if (packages) {
    updateDeps({
      rootName,
      pkg,
      version,
      depType: 'dependencies',
      packages,
    })
    updateDeps({
      rootName,
      pkg,
      version,
      depType: 'peerDependencies',
      packages,
    })
  }

  fs.writeFileSync(pkgJSONPath, JSON.stringify(pkg, null, 2) + '\n')
}

export function updatePackageLock({ pkgDir, version }: UpdatePackageParams) {
  const pkgLockJSONPath = path.resolve(pkgDir, 'package-lock.json')
  if (!fs.existsSync(pkgLockJSONPath)) return

  const pkg = JSON.parse(fs.readFileSync(pkgLockJSONPath, 'utf-8'))
  pkg.version = version

  fs.writeFileSync(pkgLockJSONPath, JSON.stringify(pkg, null, 2) + '\n')
}

interface UpdateDepsParams {
  rootName: string
  pkg: Package
  version: string
  depType: 'dependencies' | 'peerDependencies'
  packages: string[]
}

export function updateDeps({
  rootName,
  pkg,
  version,
  depType,
  packages,
}: UpdateDepsParams) {
  const deps = pkg[depType]

  if (!deps) {
    return
  }

  const reg = /\^?(\d+\.\d+\.\d+)(-(alpha|beta|next)\.\d+)?/

  Object.keys(deps).forEach(dep => {
    if (
      dep.startsWith(`@${rootName}`) &&
      packages.includes(dep.replace(new RegExp(`^@${rootName}\\/`, 'g'), ''))
    ) {
      logger.info(`${pkg.name} -> ${depType} -> ${dep}@${version}`)
      deps[dep] = deps[dep].replace(reg, version)
    }
  })
}
