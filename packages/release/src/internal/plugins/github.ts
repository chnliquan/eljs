import { getGitUrl, getGitUrlSync, parseGitRemoteUrl } from '@eljs/utils/git'
import { logger } from '@eljs/utils/logger'
import newGithubReleaseUrl from 'new-github-release-url'
import open from 'open'

import { definePlugin } from '../../define'
import { AppError } from '../../utils'

const GITHUB_API_VERSION = '2022-11-28'

/**
 * 从不可信 Git remote URL 中校验并提取的 GitHub 仓库坐标
 *
 * @remarks
 * 只有 `github.com` 和 `github.*` 主机且路径严格为 owner/repo 时才会构造该值
 */
interface GithubRepository {
  readonly apiUrl: string
  readonly owner: string
  readonly repo: string
  readonly url: string
}

export default definePlugin(context => {
  context.describe({
    enable() {
      return Boolean(getGithubRepository(getGitUrlSync(context.cwd)))
    },
  })

  context.onCheck(async () => {
    const { mode, release, tokenEnv } = context.config.github

    if (
      release &&
      mode === 'api' &&
      !context.config.dryRun &&
      !process.env[tokenEnv]
    ) {
      throw new AppError(
        `GitHub API release requires a token in the \`${tokenEnv}\` environment variable.`,
      )
    }
  })

  context.onRelease(
    async ({ version, isPrerelease, changelog }) => {
      if (
        context.config.dryRun ||
        !context.config.github.release ||
        !changelog
      ) {
        return
      }

      const gitUrl = await getGitUrl(context.cwd, true)

      if (!gitUrl) {
        return
      }
      const repository = getGithubRepository(gitUrl)

      if (!repository) {
        return
      }

      const publishablePackageNames = context.appData.workspacePackages
        .filter(({ manifest }) => !manifest.private)
        .map(({ manifest }) => manifest.name)
      const tags = context.config.git.independent
        ? publishablePackageNames.map(pkgName => `${pkgName}@${version}`)
        : [`v${version}`]

      for (const tag of tags) {
        if (context.config.github.mode === 'api') {
          const token = process.env[context.config.github.tokenEnv]

          if (!token) {
            throw new AppError(
              `GitHub API release requires a token in the \`${context.config.github.tokenEnv}\` environment variable.`,
            )
          }

          await createGithubRelease(
            repository,
            tag,
            changelog,
            isPrerelease,
            token,
          )
        } else {
          await openGithubReleasePage(
            repository.url,
            tag,
            changelog,
            isPrerelease,
          )
        }
      }
    },
    {
      // A GitHub release must never be prepared before publish and push finish.
      stage: 20,
    },
  )
})

async function openGithubReleasePage(
  repoUrl: string,
  tag: string,
  body: string,
  isPrerelease: boolean,
): Promise<void> {
  const url = newGithubReleaseUrl({ repoUrl, tag, body, isPrerelease })

  try {
    await open(url)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    logger.warn(`Could not open the GitHub Release page: ${reason}`)
    logger.info(`Open this URL manually: ${url}`)
  }
}

async function createGithubRelease(
  repository: GithubRepository,
  tag: string,
  body: string,
  isPrerelease: boolean,
  token: string,
): Promise<void> {
  const releasesUrl = `${repository.apiUrl}/repos/${encodeURIComponent(
    repository.owner,
  )}/${encodeURIComponent(repository.repo)}/releases`
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  }
  const existingResponse = await fetch(
    `${releasesUrl}/tags/${encodeURIComponent(tag)}`,
    { headers },
  )

  if (existingResponse.ok) {
    logger.warn(`GitHub Release \`${tag}\` already exists; skipping creation.`)
    return
  }

  if (existingResponse.status !== 404) {
    throw await createGithubApiError('query', tag, existingResponse)
  }

  const response = await fetch(releasesUrl, {
    body: JSON.stringify({
      body,
      name: tag,
      prerelease: isPrerelease,
      tag_name: tag,
    }),
    headers,
    method: 'POST',
  })

  if (response.ok) {
    logger.ready(`Created GitHub Release \`${tag}\` successfully.`)
    return
  }

  // 并发重试可能在首次查询后已创建同名 Release，422 时再次确认可保持幂等
  if (response.status === 422) {
    const retryResponse = await fetch(
      `${releasesUrl}/tags/${encodeURIComponent(tag)}`,
      { headers },
    )

    if (retryResponse.ok) {
      logger.warn(
        `GitHub Release \`${tag}\` was created concurrently; reusing it.`,
      )
      return
    }
  }

  throw await createGithubApiError('create', tag, response)
}

async function createGithubApiError(
  operation: 'create' | 'query',
  tag: string,
  response: Response,
): Promise<AppError> {
  const responseBody = (await response.text()).trim()
  const detail = responseBody ? ` ${responseBody.slice(0, 500)}` : ''

  return new AppError(
    `Failed to ${operation} GitHub Release \`${tag}\`: HTTP ${response.status}.${detail}`,
  )
}

function getGithubRepository(gitUrl: string): GithubRepository | undefined {
  const href = parseGitRemoteUrl(gitUrl)?.href

  if (!href) {
    return undefined
  }

  try {
    const url = new URL(href)

    if (url.hostname !== 'github.com' && !url.hostname.startsWith('github.')) {
      return undefined
    }

    const [owner, rawRepo, ...remainingSegments] = url.pathname
      .split('/')
      .filter(Boolean)

    if (!owner || !rawRepo || remainingSegments.length) {
      return undefined
    }

    const repo = rawRepo.replace(/\.git$/, '')

    if (!repo) {
      return undefined
    }

    return {
      apiUrl:
        url.hostname === 'github.com'
          ? 'https://api.github.com'
          : `${url.origin}/api/v3`,
      owner,
      repo,
      url: `${url.origin}/${owner}/${repo}`,
    }
  } catch {
    return undefined
  }
}
