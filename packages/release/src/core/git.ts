import { logger, run } from '@eljs/utils'
import { step } from '../utils'

export async function gitCheck() {
  step('Checking git ...')

  const isGitClean = (await run(`git status --porcelain`)).stdout.length

  if (isGitClean) {
    logger.printErrorAndExit('git status is not clean.')
  }

  await run('git fetch')
  const gitStatus = (
    await run('git status --short --branch', {
      verbose: false,
    })
  ).stdout.trim()

  if (gitStatus.includes('behind')) {
    logger.printErrorAndExit('git status is behind remote.')
  }
}

export async function branchCheck(branch: string) {
  step('Checking branch ...')

  const currentBranch = (
    await run(`git rev-parse --abbrev-ref HEAD`, {
      verbose: false,
    })
  ).stdout.replace(/\n|\r|\t/, '')

  if (currentBranch !== branch) {
    logger.printErrorAndExit(
      `current branch ${currentBranch} does not match branch ${branch}.`,
    )
  }
}
