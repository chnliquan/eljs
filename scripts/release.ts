import { argv } from 'zx'
import 'zx/globals'
import { logger } from '../packages/release/src/index'

import { assert, bin } from './utils'

const skipTests = argv.skipTests
const skipBuild = argv.skipBuild

main().catch(err => {
  console.error(err)
  process.exit(1)
})

async function main(): Promise<void> {
  const hasModified = (await $`git status --porcelain`).stdout.trim().length

  assert(!hasModified, 'Your git status is not clean. Aborting.')

  // run tests before release
  logger.step('Running tests ...')
  if (!skipTests) {
    await $`${bin('jest')} --clearCache`
    await $`pnpm test:once --bail --passWithNoTests`
  } else {
    console.log(`(skipped)`)
  }

  // build all packages
  logger.step('Building all packages ...')
  if (!skipBuild) {
    await $`pnpm build --no-cache`
  } else {
    console.log(`(skipped)`)
  }
  return
  // release({
  //   checkGitStatus: false,
  // })
}
