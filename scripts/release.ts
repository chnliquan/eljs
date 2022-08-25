import { argv } from 'zx'
import 'zx/globals'
import { release, resolveBin, step } from '../packages/release/src/index'

import { assert } from './utils'

const skipTests = argv.skipTests
const skipBuild = argv.skipBuild

main().catch((err: Error) => {
  console.error(`release error: ${err.message}`)
  process.exit(1)
})

async function main(): Promise<void> {
  const isGitClean = (await $`git status --porcelain`).stdout.trim().length

  assert(!isGitClean, 'Your git status is not clean. Aborting.')

  // run tests before release
  step('Running tests ...')
  if (!skipTests) {
    await $`${resolveBin.sync('jest')} --clearCache`
    await $`pnpm test:once --bail --passWithNoTests`
  } else {
    console.log(`(skipped)`)
  }

  // build all packages
  step('Building all packages ...')
  if (!skipBuild) {
    await $`pnpm build --no-cache`
  } else {
    console.log(`(skipped)`)
  }

  release({
    gitChecks: false,
    syncCnpm: true,
  })
}
