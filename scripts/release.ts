import { release } from '@eljs/release'
import { isGitBehindRemote, isGitClean, logger } from '@eljs/utils'
import { EOL } from 'node:os'
import { $, argv } from 'zx'

const skipTests = argv.skipTests
const skipBuild = argv.skipBuild
const skipRequireClean = argv.skipRequireClean

$.verbose = true

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(`release error:${EOL}${error}`)
    process.exit(1)
  })

async function main(): Promise<void> {
  if (!skipRequireClean) {
    if (!(await isGitClean())) {
      logger.printErrorAndExit('Git working tree is not clean.')
    }

    if (await isGitBehindRemote()) {
      logger.printErrorAndExit('Git working tree is behind remote.')
    }
  }

  logger.step('Release', 'Running static verification ...')
  await $`pnpm run verify:static`

  if (!skipTests) {
    logger.step('Release', 'Running tests with coverage ...')
    await $`pnpm run verify:test --bail=1`
  } else {
    logger.info('Tests skipped.')
  }

  if (!skipBuild) {
    logger.step('Release', 'Building and verifying packages ...')
    await $`pnpm run clean`
    await $`pnpm run verify:package`
  } else {
    logger.info('Package build skipped.')
  }

  // https://github.com/chnliquan/eljs/tree/master/packages/release#configuration
  await release(argv._[0], {
    ...argv,
    git: {
      ...argv.git,
      requireClean: false,
    },
    npm: {
      ...argv.npm,
      requireOwner: false,
    },
  })
}
