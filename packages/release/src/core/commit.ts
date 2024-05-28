import { gitCommit, gitPushCommit, gitPushTag, gitTag } from '@eljs/utils'

import { step } from '../utils'

export async function commit(version: string, gitPush: boolean) {
  version = `v${version}`

  await gitCommit(`chore: bump version ${version}`)

  await gitTag(version)
  await gitPushTag(version)

  if (gitPush) {
    step('Pushing commit to remote ...')
    await gitPushCommit()
  }
}
