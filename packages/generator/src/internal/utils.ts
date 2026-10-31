import {
  getGitUserSync,
  getGitUrlSync as gitUrlSync,
  parseGitRemoteUrl,
} from '@eljs/utils/git'

const account = getGitUserSync()

export const author = account.name
export const email = account.email

let _gitUrl = ''

export function getGitUrl(targetDir: string) {
  if (_gitUrl) {
    return _gitUrl
  }

  _gitUrl = gitUrlSync(targetDir)
  return _gitUrl
}

let _gitHref = ''

export function getGitHref(gitUrl: string) {
  if (_gitHref) {
    return _gitHref
  }

  _gitHref = parseGitRemoteUrl(gitUrl)?.href || '${gitHref}'
  return _gitHref
}
