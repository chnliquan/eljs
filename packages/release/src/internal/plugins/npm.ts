import {
  chalk,
  getNpmUser,
  logger,
  normalizeArgs,
  run,
  type PackageJson,
} from '@eljs/utils'
import { EOL } from 'node:os'

import type { Api, AppData } from '../../types'
import { AppError } from '../../utils'

interface PublishTarget {
  name: string
  rootPath: string
  packageJson: PackageJson
}

export function getPublishTargets(
  appData: Pick<
    AppData,
    'pkgNames' | 'pkgs' | 'validPkgNames' | 'validPkgRootPaths'
  >,
  version: string,
): PublishTarget[] {
  const { pkgNames, pkgs, validPkgNames, validPkgRootPaths } = appData

  if (validPkgNames.length !== validPkgRootPaths.length) {
    throw new AppError(
      'Publish preflight failed: package names and paths are not aligned.',
    )
  }

  const workspacePackages = new Map(
    pkgNames.map((name, index) => [name, pkgs[index]]),
  )
  const targets = validPkgNames.map((name, index) => {
    const packageJson = workspacePackages.get(name)

    if (!packageJson) {
      throw new AppError(
        `Publish preflight failed: no manifest was loaded for ${name}.`,
      )
    }

    if (packageJson.private) {
      throw new AppError(
        `Publish preflight failed: ${name} is marked as private.`,
      )
    }

    if (packageJson.version !== version) {
      throw new AppError(
        `Publish preflight failed: ${name} has version ${packageJson.version}, expected ${version}.`,
      )
    }

    return {
      name,
      rootPath: validPkgRootPaths[index],
      packageJson,
    }
  })
  const targetNames = new Set(validPkgNames)

  for (const target of targets) {
    const runtimeDependencies = {
      ...target.packageJson.dependencies,
      ...target.packageJson.optionalDependencies,
    }

    for (const dependencyName of Object.keys(runtimeDependencies)) {
      if (
        workspacePackages.has(dependencyName) &&
        !targetNames.has(dependencyName)
      ) {
        throw new AppError(
          `Publish preflight failed: ${target.name} depends on non-publishable workspace package ${dependencyName}.`,
        )
      }
    }
  }

  const targetByName = new Map(targets.map(target => [target.name, target]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const sorted: PublishTarget[] = []

  function visit(target: PublishTarget): void {
    if (visited.has(target.name)) {
      return
    }

    if (visiting.has(target.name)) {
      throw new AppError(
        `Publish preflight failed: circular runtime dependency detected at ${target.name}.`,
      )
    }

    visiting.add(target.name)

    const runtimeDependencies = {
      ...target.packageJson.dependencies,
      ...target.packageJson.optionalDependencies,
    }

    for (const dependencyName of Object.keys(runtimeDependencies)) {
      const dependency = targetByName.get(dependencyName)
      if (dependency) {
        visit(dependency)
      }
    }

    visiting.delete(target.name)
    visited.add(target.name)
    sorted.push(target)
  }

  for (const target of targets) {
    visit(target)
  }

  return sorted
}

export default (api: Api) => {
  api.onCheck(async () => {
    const { requireOwner } = api.config.npm

    if (requireOwner) {
      api.step('Checking npm owner ...')

      const user = await getNpmUser({
        cwd: api.cwd,
      })

      for (const pkgName of api.appData.validPkgNames) {
        try {
          const owners = (
            await run('npm', ['owner', 'ls', pkgName], {
              cwd: api.cwd,
            })
          ).stdout
            .trim()
            .split(EOL)
            .map(line => line.split(' ')?.[0])

          if (!owners?.includes(user)) {
            throw new AppError(
              `User ${chalk.cyan(user)} is not the owner of \`${pkgName}\`.`,
            )
          }
        } catch (error) {
          const err = error as Error

          if (err.message.indexOf('Not Found') > -1) {
            continue
          }

          throw err
        }
      }
    }
  })

  api.onRelease(
    async ({ version, prereleaseId }) => {
      const { registry, branch, packageManager } = api.appData

      api.step('Preflighting package manifests ...')
      const targets = getPublishTargets(api.appData, version)
      const existingPkgNames = new Set<string>(
        api.appData.existingPkgNames ?? [],
      )
      const pendingTargets = targets.filter(target => {
        if (!existingPkgNames.has(target.name)) {
          return true
        }

        logger.warn(
          `Skipping already published ${chalk.cyan(`${target.name}@${version}`)}.`,
        )
        return false
      })

      api.step('Publishing packages in dependency order ...')
      const publishedPackages: string[] = []

      for (let index = 0; index < pendingTargets.length; index++) {
        const target = pendingTargets[index]

        try {
          await publishPackage(target.rootPath, target.name, version)
          publishedPackages.push(target.name)
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          const notPublishedPackages = pendingTargets
            .slice(index)
            .map(({ name }) => `${name}@${version}`)

          console.log()
          logger.error(
            `Published ${chalk.cyan(`${target.name}@${version}`)} failed.`,
          )
          console.log(`Error: ${errorMessage}`)

          throw new AppError(
            [
              `Failed to publish ${target.name}@${version}.`,
              `Published before failure: ${
                publishedPackages.length
                  ? publishedPackages
                      .map(name => `${name}@${version}`)
                      .join(', ')
                  : 'none'
              }.`,
              `Not published: ${notPublishedPackages.join(', ')}.`,
              'Git changes were not pushed.',
            ].join(' '),
          )
        }
      }

      async function publishPackage(
        pkgRootPath: string,
        pkgName: string,
        version: string,
      ) {
        const tagArg = prereleaseId ? ['--tag', prereleaseId] : []
        const registryArg = registry ? ['--registry', registry] : []
        const { requireBranch } = api.config.git
        const gitCheckArg = requireBranch
          ? ['--publish-branch', requireBranch]
          : ['master', 'main'].includes(branch)
            ? []
            : ['--no-git-checks']

        const cliArgs = [
          'publish',
          ...tagArg,
          ...registryArg,
          ...gitCheckArg,
          ...normalizeArgs(api.config.npm.publishArgs),
        ].filter(Boolean)

        await run(packageManager, cliArgs, {
          cwd: pkgRootPath,
          verbose: true,
          stdin: 'inherit',
        })

        logger.ready(
          `Published ${chalk.bold.cyan(`${pkgName}@${version}`)} successfully.`,
        )
      }
    },
    {
      // Publish after the local release commit/tag, but before any remote push.
      stage: 0,
    },
  )
}
