import { release, resolveBin } from '@eljs/release'
import { isGitBehindRemote, isGitClean, logger } from '@eljs/utils'
import { $, argv } from 'zx'

const skipGitCheck = argv.skipGitCheck
const skipTests = argv.skipTests
const skipBuild = argv.skipBuild

$.verbose = true

main()

async function main(): Promise<void> {
  if (!skipGitCheck) {
    if (!(await isGitClean())) {
      logger.printErrorAndExit('git is not clean.')
    }

    if (await isGitBehindRemote()) {
      logger.printErrorAndExit('git is behind remote.')
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
      skipCheck: true,
    },
    npm: {
      skipCheck: true,
      cnpm: true,
    },
  })
}
