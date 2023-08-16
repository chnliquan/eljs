import { existsSync, PkgJSON, readJSONSync } from '@eljs/utils'
import fs from 'fs'
import glob from 'glob'
import yaml from 'js-yaml'
import path from 'path'

export function getPkgPaths(cwd = process.cwd()) {
  const pkgPaths: string[] = []

  try {
    const doc = yaml.load(
      fs.readFileSync(path.resolve(cwd, './pnpm-workspace.yaml'), 'utf8'),
    ) as {
      packages: string[]
    }

    if (doc.packages?.length) {
      doc.packages.forEach(matcher => {
        matcher = matcher.replace(/\/\*+$/, '/*')
        if (matcher.endsWith('/*')) {
          const partialPkgPaths = glob.sync(matcher, {
            cwd,
            ignore: '*/*.*',
          })
          pkgPaths.push(...partialPkgPaths)
        } else if (existsSync(path.resolve(cwd, matcher))) {
          pkgPaths.push(matcher)
        }
      })
    }
  } catch (err) {
    // ...
  }

  return pkgPaths
}

export function getPublishPkgInfo(opts: {
  cwd: string
  rootPkgJSON: PkgJSON
  pkgPaths: string[]
}) {
  const { cwd, rootPkgJSON, pkgPaths } = opts
  const publishPkgDirs: string[] = []
  const publishPkgNames: string[] = []

  // TODO：check the validity of package.json
  if (pkgPaths.length > 0) {
    pkgPaths.forEach(pkgPath => {
      const pkgDir = path.join(cwd, pkgPath)
      const pkgJSONPath = path.join(pkgDir, 'package.json')
      const pkgJSON: PkgJSON = readJSONSync(pkgJSONPath)

      if (!pkgJSON.private) {
        publishPkgDirs.push(pkgDir)
        publishPkgNames.push(pkgJSON.name as string)
      }
    })
  } else {
    publishPkgDirs.push(cwd)
    publishPkgNames.push(rootPkgJSON.name as string)
  }

  return {
    publishPkgDirs,
    publishPkgNames,
  }
}
