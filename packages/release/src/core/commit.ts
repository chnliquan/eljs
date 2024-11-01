import { step } from '@/utils'
import { gitCommit, gitPushCommit, gitTag } from '@eljs/utils'

export async function commit(opts: {
  version: string
  gitPush: boolean
  independent: boolean
  pkgNames: string[]
}) {
  const { version, gitPush, independent, pkgNames } = opts
  const tags = independent
    ? pkgNames.map(pkgName => `${pkgName}@${version}`)
    : [`v${version}`]

  await gitCommit(`chore: bump version v${version}`)

  for await (const tag of tags) {
    await gitTag(tag)
  }

  if (gitPush) {
    step('Pushing commit to remote ...')
    await gitPushCommit()
  }
}
