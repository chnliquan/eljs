import { chalk, getNpmRegistry, logger } from '@eljs/utils'

export async function checkRegistry(opts: {
  cwd: string
  repoType: string
  repoUrl?: string
  pkgRegistry?: string
}) {
  const { cwd, repoType, repoUrl, pkgRegistry } = opts

  let registry = ''

  if (repoType === 'github') {
    if (repoUrl) {
      try {
        new URL(repoUrl)
      } catch {
        logger.printErrorAndExit(`github repo url is invalid: ${repoUrl}.`)
      }
    }

    registry = 'https://registry.npmjs.org'
  } else if (pkgRegistry) {
    try {
      const url = new URL(pkgRegistry)
      registry = url.origin
    } catch {
      // ...
    }
  }

  if (registry) {
    const userRegistry = await getNpmRegistry(cwd)

    if (!userRegistry.includes(registry)) {
      logger.printErrorAndExit(
        `Expect the registry is ${chalk.blue(
          userRegistry,
        )}, but got ${chalk.blue(registry)}.`,
      )
    }
  }
}
