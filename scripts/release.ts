import { release, resolveBin, step } from '@eljs/release'
import { isGitBehindRemote, isGitClean, logger } from '@eljs/utils'
import { $, argv } from 'zx'

const dry = argv.dry
const skipGitCheck = argv.skipGitCheck
const skipTests = argv.skipTests
const skipBuild = argv.skipBuild

$.verbose = true

main().catch((err: Error) => {
  console.error(`release error: ${err.message}.`)
  process.exit(1)
})

async function main(): Promise<void> {
  if (!dry && !skipGitCheck) {
    if (!(await isGitClean())) {
      logger.printErrorAndExit('git is not clean.')
    }

    if (await isGitBehindRemote()) {
      logger.printErrorAndExit('git is behind remote.')
    }
  }

  // run tests before release
  step('Release Running tests ...')
  if (!dry && !skipTests) {
    await $`${resolveBin.sync('jest')} --clearCache`
    await $`pnpm test:once --bail --passWithNoTests`
  } else {
    console.log(`(skipped)`)
  }

  // build all packages
  step('Building all packages ...')
  if (!dry && !skipBuild) {
    await $`pnpm clean`
    await $`pnpm build --force`
  } else {
    console.log(`(skipped)`)
  }

  release({
    ...argv,
    gitCheck: false,
    registryCheck: false,
    ownershipCheck: false,
    syncCnpm: true,
    version: argv._[0],
  })
}
