import fs from 'fs'
import ini from 'ini'
import path from 'path'
import { URL } from 'url'
import { GitInfo, GitRepo } from './types'

function getProjectGitDir(dir: string): string | undefined {
  let current = dir

  while (current) {
    // 如果配置存在, 说明是 .git 目录
    if (fs.existsSync(path.join(current, '.git', 'config'))) {
      return path.join(current, '.git')
    }

    const parent = path.dirname(current)

    if (parent === current) {
      break
    } else {
      current = parent
    }
  }
}

export function normalizeGitRepo(url: string): GitRepo {
  let repo = ''
  let hostname = ''

  if (url.startsWith('git')) {
    // git@git.corp.xxx.com:group/eljs.git
    // git@github.com:chnliquan/eljs.git
    const pieces = url.split(':')
    hostname = pieces[0].split('@')[1]
    repo = pieces[1].replace(/\.git$/, '')
  } else if (url.startsWith('http')) {
    // https://git.corp.xxx.com/group/eljs.git
    // https://github.com/chnliquan/eljs.git
    const parsedUrl = new URL(url)
    hostname = parsedUrl.hostname || ''
    repo = parsedUrl.pathname?.slice(1)?.replace(/\.git$/, '') || ''
  }

  let group = ''
  let name = ''

  repo.split('/').forEach((str, index, arr) => {
    if (index === arr.length - 1) {
      name = str
    } else {
      group += `/${str}`
    }
  })

  group = group.substring(1)

  return {
    name,
    group,
    href: `https://${hostname}/${group}/${name}`,
  }
}

export function getGitUrl(dir: string, exact?: boolean): string {
  const gitDir = exact ? path.join(dir, '.git') : getProjectGitDir(dir) || ''

  if (!fs.existsSync(gitDir)) {
    return ''
  }

  try {
    const parsed = ini.parse(
      fs.readFileSync(path.join(gitDir, 'config'), 'utf8'),
    )

    if (parsed['remote "origin"']) {
      return parsed['remote "origin"'].url
    }
  } catch (err) {
    // catch error
  }

  return ''
}

export function getGitInfo(dir: string, exact?: boolean): GitInfo | null {
  const gitDir = exact ? path.join(dir, '.git') : getProjectGitDir(dir) || ''

  if (!fs.existsSync(gitDir)) {
    return null
  }

  const gitInfo: GitInfo = {
    name: '',
    group: '',
    href: '',
    url: '',
    branch: '',
  }

  try {
    const config = ini.parse(
      fs.readFileSync(path.join(gitDir, 'config'), 'utf8'),
    )
    // remote
    if (config['remote "origin"']) {
      gitInfo.url = config['remote "origin"'].url

      if (gitInfo.url) {
        const repo = normalizeGitRepo(gitInfo.url)
        gitInfo.href = repo.href
        gitInfo.group = repo.group
        gitInfo.name = repo.name
      }
    }
    // branch
    const gitHead = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8')
    gitInfo.branch = gitHead.replace('ref: refs/heads/', '').replace('\n', '')
  } catch (err) {
    // catch error
  }

  return gitInfo
}
