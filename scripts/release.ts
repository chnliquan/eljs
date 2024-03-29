import { release, resolveBin, step } from '@eljs/release'
import { argv } from 'zx'
import 'zx/globals'

import { assert } from './utils'

const dry = argv.dry
const skipTests = argv.skipTests
const skipBuild = argv.skipBuild
const skipRegistryChecks = argv.skipRegistryChecks || true
const skipOwnershipChecks = argv.skipOwnershipChecks || true
const skipSyncCnpm = argv.skipSyncCnpm

main().catch((err: Error) => {
  console.error(`release error: ${err.message}`)
  process.exit(1)
})

async function main(): Promise<void> {
  if (!dry) {
    const isGitClean = (await $`git status --porcelain`).stdout.trim().length
    assert(!isGitClean, 'git status is not clean.')

    await $`git fetch`
    const gitStatus = (await $`git status --short --branch`).stdout.trim()
    assert(!gitStatus.includes('behind'), 'git status is behind remote.')
  }

  // run tests before release
  step('Running tests ...')
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
    gitChecks: false,
    registryChecks: !skipRegistryChecks,
    ownershipChecks: !skipOwnershipChecks,
    syncCnpm: !skipSyncCnpm,
    version: argv._[0],
  })
}
