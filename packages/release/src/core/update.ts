import {
  getPackageManager,
  logger,
  runCommand,
  writeJSONSync,
  type PkgJSON,
} from '@eljs/utils'

export async function updateLock(cwd: string) {
  const packageManager = await getPackageManager(cwd)
  let command = ''

  if (packageManager === 'pnpm') {
    command = 'pnpm install --prefer-offline'
  } else if (packageManager === 'yarn') {
    command = 'yarn install --frozen-lockfile'
  } else if (packageManager === 'bun') {
    command = 'bun install --frozen-lockfile'
  } else {
    command = 'npm install --package-lock-only'
  }

  await runCommand(command)
}

export function updateVersions(opts: {
  rootPkgJSONPath: string
  rootPkgJSON: Required<PkgJSON>
  pkgNames: string[]
  pkgJSONPaths: string[]
  pkgJSONs: Required<PkgJSON>[]
  version: string
}) {
  const {
    rootPkgJSONPath,
    rootPkgJSON,
    pkgNames,
    pkgJSONPaths,
    pkgJSONs,
    version,
  } = opts

  // update all packages
  pkgNames.forEach((_, index) => {
    updatePackage({
      pkgJSONPath: pkgJSONPaths[index],
      pkgJSON: pkgJSONs[index],
      pkgNames,
      version,
    })
  })

  if (pkgJSONPaths[0] !== rootPkgJSONPath) {
    // update polyrepo root package.json
    updatePackage({
      pkgJSONPath: rootPkgJSONPath,
      pkgJSON: rootPkgJSON,
      version,
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

  writeJSONSync(pkgJSONPath, pkgJSON)
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
      // 只替换固定版本，不替换 workspace
      deps[depName] = deps[depName].replace(reg, version)
    }
  })
}
