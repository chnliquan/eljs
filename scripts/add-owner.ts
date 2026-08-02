import { readJson } from '@eljs/utils/file'
import { chalk, logger } from '@eljs/utils/logger'
import { getWorkspacePackageRoots } from '@eljs/utils/path'
import type { PackageJson } from '@eljs/utils/types'
import { EOL } from 'node:os'
import path from 'node:path'
import { $, argv } from 'zx'

$.verbose = true

main().catch(error => {
  console.error(`add owner error:${EOL}${error}`)
  process.exitCode = 1
})

async function main(): Promise<void> {
  const owners = [
    ...new Set(argv._.map(String).map(owner => owner.trim())),
  ].filter(Boolean)

  if (!owners.length) {
    throw new Error('Please enter at least one npm owner name.')
  }

  const rootPath = path.resolve(__dirname, '../')
  const workspaces = await getWorkspacePackageRoots(rootPath)
  const packages: Array<{
    name: string
    registry?: string
  }> = []

  for (const workspace of workspaces) {
    const packageJson = await readJson<PackageJson>(
      path.resolve(workspace, 'package.json'),
    )

    if (packageJson.private) {
      continue
    }

    if (!packageJson.name) {
      logger.warn(`Skipped package without a name: ${chalk.cyan(workspace)}.`)
      continue
    }

    packages.push({
      name: packageJson.name,
      registry: packageJson.publishConfig?.registry,
    })
  }

  const failures: Array<{
    owner: string
    packageName: string
    error: unknown
  }> = []

  for (const owner of owners) {
    for (const packageJson of packages) {
      const registryArgs = packageJson.registry
        ? ['--registry', packageJson.registry]
        : []

      try {
        await $`npm owner add ${owner} ${packageJson.name} ${registryArgs}`
        logger.ready(
          `User ${chalk.cyan(owner)} now has permission for ${packageJson.name}.`,
        )
      } catch (error) {
        failures.push({
          owner,
          packageName: packageJson.name,
          error,
        })
      }
    }
  }

  if (failures.length) {
    const details = failures
      .map(({ owner, packageName, error }) => {
        const message = error instanceof Error ? error.message : String(error)
        return `- ${owner} → ${packageName}: ${message}`
      })
      .join(EOL)

    throw new Error(
      `${failures.length} npm owner operation(s) failed:${EOL}${details}`,
    )
  }
}
