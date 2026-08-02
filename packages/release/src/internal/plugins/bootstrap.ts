import { pathExists, readJson } from '@eljs/utils/file'
import { getGitBranch, getGitLatestTag } from '@eljs/utils/git'
import { chalk, logger } from '@eljs/utils/logger'
import { getWorkspacePackageRoots } from '@eljs/utils/path'
import type { PackageJson } from '@eljs/utils/types'
import path from 'node:path'

import { definePlugin } from '../../define'
import type { WorkspacePackage } from '../../types'
import { AppError } from '../../utils'

export default definePlugin(context => {
  context.modifyAppData(
    async (memo, { cwd }) => {
      const packageRootPaths = await getWorkspacePackageRoots(cwd)

      const workspaceCandidates = await Promise.all(
        packageRootPaths.map(async packageRootPath => {
          const pkgJsonPath = path.join(packageRootPath, 'package.json')

          if (!(await pathExists(pkgJsonPath))) {
            return null
          }

          return {
            rootPath: packageRootPath,
            manifest: await readJson<PackageJson>(pkgJsonPath),
            manifestPath: pkgJsonPath,
          }
        }),
      )

      const workspacePackages: WorkspacePackage[] = []
      for (const candidate of workspaceCandidates) {
        if (!candidate) {
          continue
        }

        const { rootPath, manifest, manifestPath } = candidate

        if (!manifest.name) {
          logger.warn(
            `No name field was found in ${chalk.cyan(manifestPath)}, skipped.`,
          )
          continue
        }

        workspacePackages.push({
          manifest: manifest as WorkspacePackage['manifest'],
          manifestPath,
          rootPath,
        })
      }

      const configuredRegistry = context.config.npm.registry
      const rootRegistry = memo.projectPkg?.publishConfig?.registry
      const publishablePackages = workspacePackages.filter(
        ({ manifest }) => !manifest.private,
      )
      const packageRegistries = publishablePackages
        .map(({ manifest }) => manifest.publishConfig?.registry)
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
            normalizeRegistry(registry) !==
              normalizeRegistry(configuredRegistry),
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

      const registry =
        configuredRegistry ?? rootRegistry ?? packageRegistries[0]
      const branch = await getGitBranch({
        cwd,
      })
      const latestTag = await getGitLatestTag({
        cwd,
      })

      if (publishablePackages.length === 0) {
        throw new AppError(`No valid package to publish in ${chalk.cyan(cwd)}.`)
      }

      return {
        ...memo,
        workspacePackages,
        registry,
        branch,
        latestTag,
      }
    },
    // 先补全运行器 seed，确保后续业务插件收到语义完整的 AppData
    { stage: Number.NEGATIVE_INFINITY },
  )
})

function normalizeRegistry(registry: string): string {
  return registry.replace(/\/+$/, '')
}
