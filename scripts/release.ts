import { release, resolveBin } from '@eljs/release'
import { isGitBehindRemote, isGitClean, logger } from '@eljs/utils'
import { $, argv } from 'zx'

const skipTests = argv.skipTests
const skipBuild = argv.skipBuild
const skipRequireClean = argv.skipRequireClean

$.verbose = true

main()

async function main(): Promise<void> {
  if (!skipRequireClean) {
    if (!(await isGitClean())) {
      logger.printErrorAndExit('Git working tree is not clean.')
    }

    if (await isGitBehindRemote()) {
      logger.printErrorAndExit('Git working tree is behind remote.')
    }
  }

  // run tests before release
  logger.step('Release', 'Running tests ...')
  if (!skipTests) {
    await $`${resolveBin.sync('jest')} --clearCache`
    await $`pnpm run test --bail --passWithNoTests`
  } else {
    console.log(`(skipped)`)
  }

  // build all packages
  logger.step('Release', 'Building all packages ...')
  if (!skipBuild) {
    await $`pnpm run clean`
    await $`pnpm run build --force`
  } else {
    console.log(`(skipped)`)
  }

  await release(argv._[0], {
    ...argv,
    git: {
      ...argv.git,
      requireClean: false,
    },
    npm: {
      ...argv.npm,
      requireOwner: false,
      cnpm: true,
    },
  })
}
