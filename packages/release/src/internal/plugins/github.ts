import { getGitUrl, getGitUrlSync, gitUrlAnalysis } from '@eljs/utils'
import newGithubReleaseUrl from 'new-github-release-url'
import open from 'open'

import type { Api } from '../../types'

export default (api: Api) => {
  api.describe({
    enable() {
      return getGitUrlSync(api.cwd).includes('github')
    },
  })

  api.onRelease(async ({ version, isPrerelease, changelog }) => {
    if (!api.config.github.release || !changelog) {
      return
    }

    const gitUrl = await getGitUrl(api.cwd, true)

    if (!gitUrl) {
      return
    }
    const repoUrl = gitUrlAnalysis(gitUrl)?.href

    if (!repoUrl) {
      return
    }

    const url = await newGithubReleaseUrl({
      repoUrl,
      tag: `v${version}`,
      body: changelog,
      isPrerelease,
    })

    await open(url)
  })
}
