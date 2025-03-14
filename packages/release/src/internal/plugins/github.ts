import type { Api } from '@/types'
import { getGitUrl, getGitUrlSync, gitUrlAnalysis, readFile } from '@eljs/utils'
import newGithubReleaseUrl from 'new-github-release-url'
import path from 'node:path'
import open from 'open'

export default (api: Api) => {
  api.describe({
    enable() {
      return getGitUrlSync(api.cwd).includes('github')
    },
  })

  api.onRelease(async ({ version, isPrerelease, changelog }) => {
    const { createRelease } = api.config.github

    if (!createRelease) {
      return
    }

    let body = ''

    if (changelog) {
      body = changelog
    } else {
      try {
        body = await readFile(path.join(api.cwd, 'LATESTLOG.md'))
      } catch (error) {
        //
      }
    }

    if (!body) {
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
      body,
      isPrerelease,
    })

    await open(url)
  })
}
