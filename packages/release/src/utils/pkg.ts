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
        if (matcher.endsWith('/*')) {
          const partialPkgPaths = glob.sync(matcher, {
            cwd,
            ignore: '*/*.*',
          })
          pkgPaths.push(...partialPkgPaths)
        } else {
          pkgPaths.push(matcher)
        }
      })
    }
  } catch (err) {
    // ...
  }

  return pkgPaths
}
