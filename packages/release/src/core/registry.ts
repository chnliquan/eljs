import { chalk, getNpmRegistry, logger } from '@eljs/utils'
import { step } from '../utils'

export async function registryCheck(opts: {
  repoType: string
  repoUrl?: string
  pkgRegistry?: string
}) {
  const { repoType, repoUrl, pkgRegistry } = opts

  step('Checking registry ...')
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
    const userRegistry = await getNpmRegistry()

    if (!userRegistry.includes(registry)) {
      logger.printErrorAndExit(`npm registry is not ${chalk.blue(registry)}.`)
    }
  }
}
