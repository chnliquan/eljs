import {
  getGitUserSync,
  gitUrlAnalysis,
  getGitUrlSync as gitUrlSync,
} from '@eljs/utils'

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

  _gitHref = gitUrlAnalysis(gitUrl)?.href || '${gitUrl}'
  return _gitHref
}
