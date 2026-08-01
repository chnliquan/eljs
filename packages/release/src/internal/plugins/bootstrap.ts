import {
  chalk,
  getGitBranch,
  getGitLatestTag,
  getWorkspaces,
  isPathExists,
  logger,
  readJson,
  type PackageJson,
} from '@eljs/utils'
import path from 'node:path'

import { definePlugin } from '../../define'
import type { WorkspacePackageJson } from '../../types'
import { AppError } from '../../utils'

export default definePlugin(context => {
  context.modifyAppData(async (memo, { cwd }) => {
    const packageRootPaths = await getWorkspaces(cwd)

    const pkgJsonPaths: string[] = []
    const pkgs: WorkspacePackageJson[] = []
    const pkgNames: string[] = []
    const validPkgRootPaths: string[] = []
    const validPkgNames: string[] = []

    const manifests = await Promise.all(
      packageRootPaths.map(async packageRootPath => {
        const pkgJsonPath = path.join(packageRootPath, 'package.json')

        if (!(await isPathExists(pkgJsonPath))) {
          return null
        }

        return {
          packageRootPath,
          pkg: await readJson<PackageJson>(pkgJsonPath),
          pkgJsonPath,
        }
      }),
    )

    for (const manifest of manifests) {
      if (!manifest) {
        continue
      }

      const { packageRootPath, pkg, pkgJsonPath } = manifest

      if (!pkg.name) {
        logger.warn(
          `No name field was found in ${chalk.cyan(pkgJsonPath)}, skipped.`,
        )
        continue
      }

      if (!pkg.private) {
        validPkgRootPaths.push(packageRootPath)
        validPkgNames.push(pkg.name as string)
      }

      pkgJsonPaths.push(pkgJsonPath)
      pkgs.push(pkg as WorkspacePackageJson)
      pkgNames.push(pkg.name)
    }

    const configuredRegistry = context.config.npm.registry
    const rootRegistry = memo.projectPkg?.publishConfig?.registry
    const publishablePackages = pkgs.filter(pkg => !pkg.private)
    const packageRegistries = publishablePackages
      .map(pkg => pkg.publishConfig?.registry)
      .filter((registry): registry is string => Boolean(registry))
    const manifestRegistries = new Set(
      [rootRegistry, ...packageRegistries]
        .filter((registry): registry is string => Boolean(registry))
        .map(normalizeRegistry),
    )

    if (
      configuredRegistry &&
      memo.packageManagerVariant === 'yarn-berry' &&
      [rootRegistry, ...packageRegistries].some(
        registry =>
          registry &&
          normalizeRegistry(registry) !== normalizeRegistry(configuredRegistry),
      )
    ) {
      throw new AppError(
        'Yarn Berry gives `publishConfig.registry` precedence over `npm.registry`. Align or remove the manifest registry before releasing.',
      )
    }

    if (!configuredRegistry && manifestRegistries.size > 1) {
      throw new AppError(
        'Publishable package manifests declare different registries. Configure `npm.registry` explicitly.',
      )
    }

    if (
      !configuredRegistry &&
      !rootRegistry &&
      packageRegistries.length > 0 &&
      packageRegistries.length !== publishablePackages.length
    ) {
      throw new AppError(
        'Only some publishable package manifests declare a registry. Configure `npm.registry` explicitly.',
      )
    }

    const registry = configuredRegistry ?? rootRegistry ?? packageRegistries[0]
    const branch = await getGitBranch({
      cwd,
    })
    const latestTag = await getGitLatestTag({
      cwd,
    })

    if (validPkgNames.length === 0) {
      throw new AppError(`No valid package to publish in ${chalk.cyan(cwd)}.`)
    }

    return {
      ...memo,
      pkgJsonPaths,
      pkgs,
      pkgNames,
      validPkgRootPaths,
      validPkgNames,
      registry,
      branch,
      latestTag,
    }
  })
})

function normalizeRegistry(registry: string): string {
  return registry.replace(/\/+$/, '')
}
