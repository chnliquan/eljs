import { getGitBranch, run } from '@eljs/utils'

export async function commit(version: string, gitPush: boolean) {
  await run(`git add -A`)
  await run(`git commit -m chore:\\ bump\\ version\\ v${version}`)

  await run(`git tag v${version}`)
  await run(`git push origin refs/tags/v${version}`)

  if (gitPush) {
    const branch = await getGitBranch()
    await run(`git push --set-upstream origin ${branch}`)
  }
}
