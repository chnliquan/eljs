import { release, resolveBin, step, utils } from '@eljs/release'
import { $, argv } from 'zx'
import 'zx/globals'

import { assert } from './utils'

const dry = argv.dry
const skipGit = argv.skipGit
const skipTests = argv.skipTests
const skipBuild = argv.skipBuild
const skipRegistryCheck = argv.skipRegistryCheck || true
const skipOwnershipCheck = argv.skipOwnershipCheck || true
const skipSyncCnpm = argv.skipSyncCnpm

main().catch((err: Error) => {
  console.error(`release error: ${err.message}.`)
  process.exit(1)
})

async function main(): Promise<void> {
  if (!skipGit && !dry) {
    assert(!(await utils.isGitClean()), 'git is not clean.')
    assert(await utils.isGitBehindRemote(), 'git is behind remote.')
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
    gitCheck: false,
    registryCheck: !skipRegistryCheck,
    ownershipCheck: !skipOwnershipCheck,
    syncCnpm: !skipSyncCnpm,
    version: argv._[0],
  })
}
