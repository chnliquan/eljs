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

export function getGitHref(targetDir: string, gitUrl?: string) {
  if (_gitHref) {
    return _gitHref
  }

  gitUrl = gitUrl || getGitUrl(targetDir)

  _gitHref = gitUrlAnalysis(gitUrl)?.href || ''
  return _gitHref
}
