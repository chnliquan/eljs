import { getGitUser, getGitUrl as gitUrl, gitUrlAnalysis } from '@eljs/utils'

const account = getGitUser()

export const author = account.name
export const email = account.email

let _gitUrl = ''

export function getGitUrl(targetDir: string) {
  if (_gitUrl) {
    return _gitUrl
  }

  _gitUrl = gitUrl(targetDir)
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
