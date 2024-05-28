import { release, resolveBin, step } from '@eljs/release'
import { isGitBehindRemote, isGitClean } from '@eljs/utils'
import { $, argv } from 'zx'

import { assert } from './utils'

const dry = argv.dry
const skipGit = argv.skipGit
const skipTests = argv.skipTests
const skipBuild = argv.skipBuild

main().catch((err: Error) => {
  console.error(`release error: ${err.message}.`)
  process.exit(1)
})

async function main(): Promise<void> {
  if (!skipGit && !dry) {
    assert(await isGitClean(), 'git is not clean.')
    assert(!(await isGitBehindRemote()), 'git is behind remote.')
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
