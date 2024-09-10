import { getGitUrl as gitUrl, getGitUser, gitUrlAnalysis } from '@eljs/utils';
var account = getGitUser();
export var author = account.name;
export var email = account.email;
var _gitUrl = '';
export function getGitUrl(targetDir) {
  if (_gitUrl) {
    return _gitUrl;
  }
  _gitUrl = gitUrl(targetDir);
  return _gitUrl;
}
var _gitHref = '';
export function getGitHref(targetDir, gitUrl) {
  if (_gitHref) {
    return _gitHref;
  }
  gitUrl = gitUrl || getGitUrl(targetDir);
  _gitHref = gitUrlAnalysis(gitUrl).href;
  return _gitHref;
}