import {
  logger,
  runCommand,
  writeJson,
  type PackageJson,
  type PackageManager,
  type RunCommandChildProcess,
  type RunCommandOptions,
} from '@eljs/utils'

/**
 * 更新 lock 文件
 * @param packageManager 包管理工具
 * @param cwd 当前工作目录
 */
export async function updatePackageLock(
  packageManager: PackageManager,
  options?: RunCommandOptions,
): Promise<void> {
  let command = ''

  if (packageManager === 'pnpm') {
    command = 'pnpm install --lockfile-only'
  } else if (packageManager === 'yarn') {
    command = 'yarn install'
  } else if (packageManager === 'bun') {
    command = 'bun install --lockfile-only'
  } else {
    command = 'npm install --package-lock-only'
  }

  let child: RunCommandChildProcess | undefined = undefined

  try {
    child = runCommand(command, {
      ...options,
    })

    child.stdout?.on('data', chunk => {
      const content = chunk.toString() as string
      if (content.startsWith('ERR_PNPM')) {
        child?.kill()
      }
    })

    child.stderr?.on('data', () => {
      child?.kill()
    })

    child.on('close', code => {
      if (code !== 0) {
        child?.kill()
      }
    })
    await child
  } catch (_) {
    child?.kill()
  }
}

/**
 * 更新包版本
 * @param pkgJsonPath package.json 路径
 * @param pkg package.json 对象
 * @param version 版本
 * @param pkgNames 包名
 */
export async function updatePackageVersion(
  pkgJsonPath: string,
  pkg: PackageJson,
  version: string,
  pkgNames?: string[],
) {
  pkg.version = version

  if (pkgNames?.length) {
    updatePackageDependencies(pkg, 'dependencies', version, pkgNames)
    updatePackageDependencies(pkg, 'devDependencies', version, pkgNames)
    updatePackageDependencies(pkg, 'peerDependencies', version, pkgNames)
  }

  await writeJson(pkgJsonPath, pkg)
}

/**
 * 更新包依赖的版本
 * @param pkg package.json 对象
 * @param type 依赖类型
 * @param version 版本
 * @param pkgNames 包名
 */
export function updatePackageDependencies(
  pkg: PackageJson,
  type: 'dependencies' | 'devDependencies' | 'peerDependencies',
  version: string,
  pkgNames: string[],
) {
  const deps = pkg[type]

  if (!deps) {
    return
  }

  const reg = /\^?(\d+\.\d+\.\d+)(-(alpha|beta|next)\.\d+)?/

  Object.entries(deps).forEach(([depName, depValue]) => {
    if (!pkgNames.includes(depName)) {
      return
    }

    if (
      depValue.startsWith('workspace') &&
      !/^workspace:[^\s]+/.test(depValue)
    ) {
      throw new Error(
        `Invalid workspace protocol \`${depValue}\` in \`${depName}\`.`,
      )
    }

    logger.info(`${pkg.name} -> ${type} -> ${depName}@${version}`)
    // 只替换固定版本，不替换 workspace
    deps[depName] = deps[depName].replace(reg, version)
  })
}
