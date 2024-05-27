import { getGitBranch, run } from '@eljs/utils'
import { step } from '../utils'

export async function commit(version: string, gitPush: boolean) {
  step('Committing changes ...')

  await run(`git add -A`)
  await run(`git commit -m chore:\\ bump\\ version\\ v${version}`)

  step('Pushing to git remote ...')
  await run(`git tag v${version}`)

  if (gitPush) {
    const branch = await getGitBranch()
    await run(`git push origin refs/tags/v${version}`)
    await run(`git push --set-upstream origin ${branch}`)
  }
}
