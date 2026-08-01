import { getGitUrl, getGitUrlSync, gitUrlAnalysis } from '@eljs/utils'
import newGithubReleaseUrl from 'new-github-release-url'
import open from 'open'

import { definePlugin } from '../../define'

export default definePlugin(context => {
  context.describe({
    enable() {
      return getGitUrlSync(context.cwd).includes('github')
    },
  })

  context.onRelease(
    async ({ version, isPrerelease, changelog }) => {
      if (!context.config.github.release || !changelog) {
        return
      }

      const gitUrl = await getGitUrl(context.cwd, true)

      if (!gitUrl) {
        return
      }
      const repoUrl = gitUrlAnalysis(gitUrl)?.href

      if (!repoUrl) {
        return
      }

      const url = newGithubReleaseUrl({
        repoUrl,
        tag: `v${version}`,
        body: changelog,
        isPrerelease,
      })

      await open(url)
    },
    {
      // A GitHub release must never be prepared before publish and push finish.
      stage: 20,
    },
  )
})
