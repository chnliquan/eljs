import execa from 'execa'
import fs from 'fs'
import ini from 'ini'
import os from 'os'
import path from 'path'
import { URL } from 'url'
import { isPathExistsSync } from '../file'

/**
 * 基础 git 仓库信息
 */
export interface BaseGitRepoInfo {
  /**
   * git 仓库名称
   */
  name: string
  /**
   * git 仓库所属的组
   */
  group: string
  /**
   * git 仓库网页地址
   */
  href: string
  /**
   * git url
   */
  url: string
}

/**
 * git 仓库信息
 */
export interface GitRepoInfo extends BaseGitRepoInfo {
  /**
   * git 仓库克隆地址
   */
  url: string
  /**
   * git 仓库分支
   */
  branch: string
  /**
   * git 仓库作者
   */
  author: string
  /**
   * 仓库邮箱
   */
  email: string
}

/**
 * 获取指定目录的 git 地址
 * @param cwd 当前工作目录
 * @param exact 是否在当前目录下提取
 */
export function getGitUrl(cwd: string, exact?: boolean): string {
  const gitDir = exact ? path.join(cwd, '.git') : getProjectGitDir(cwd) || ''

  if (!isPathExistsSync(gitDir)) {
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

/**
 * 获取指定工作目录的 git 分支
 * @param cwd 当前工作目录
 * @returns 当前分支
 */
export async function getGitBranch(cwd?: string): Promise<string> {
  return execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd,
  }).then(data => {
    // .replace(/\n|\r|\t/, '')
    return data.stdout.trim()
  })
}

/**
 * 获取指定工作目录的 git commit 哈希值
 * @param cwd 当前工作目录
 * @param short 是否截断
 * @returns sha
 */
export async function getGitCommitSha(
  cwd?: string,
  short = false,
): Promise<string> {
  return execa('git', ['rev-parse', ...(short ? ['--short'] : []), 'HEAD'], {
    cwd,
  }).then(data => {
    return data.stdout.trim()
  })
}

/**
 * 解析 git 地址
 * @param url git 地址
 */
export function gitUrlAnalysis(url: string): BaseGitRepoInfo {
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
    url: `git@${hostname}:${group}/${name}.git`,
  }
}

/**
 * 获取指定目录的 git 仓库信息
 * @param dir 指定的目录
 * @param exact 是否在当前目录下提取
 */
export function getGitRepoInfo(
  dir: string,
  exact?: boolean,
): GitRepoInfo | null {
  const gitDir = exact ? path.join(dir, '.git') : getProjectGitDir(dir) || ''

  if (!isPathExistsSync(gitDir)) {
    return null
  }

  const gitRepoInfo: GitRepoInfo = {
    name: '',
    group: '',
    href: '',
    url: '',
    branch: '',
    author: '',
    email: '',
  }

  try {
    const config = ini.parse(
      fs.readFileSync(path.join(gitDir, 'config'), 'utf8'),
    )
    // remote
    if (config['remote "origin"']) {
      gitRepoInfo.url = config['remote "origin"'].url

      if (gitRepoInfo.url) {
        Object.assign(gitRepoInfo, gitUrlAnalysis(gitRepoInfo.url))
      }
    }

    if (config['user']) {
      gitRepoInfo.author = config['user'].name
      gitRepoInfo.email = config['user'].email
    }

    // branch
    const gitHead = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8')
    gitRepoInfo.branch = gitHead
      .replace('ref: refs/heads/', '')
      .replace('\n', '')
  } catch (err) {
    return null
  }

  return gitRepoInfo
}

/**
 * git 用户
 */
export interface GitUser {
  /**
   * 用户名
   */
  name: string
  /**
   * 用户邮箱
   */
  email: string
}

/**
 * 获取 git 用户
 */
export function getGitUser(): GitUser {
  let user: GitUser = {
    name: '',
    email: '',
  }

  // try to get config by git
  try {
    const gitConfig = execa.sync('git', ['config', '--list']).stdout

    if (gitConfig) {
      const config = Object.create(null)

      gitConfig.split(os.EOL).forEach(line => {
        const [key, value] = line.split('=')
        config[key] = value
      })

      if (config['user.email']) {
        user = {
          name: config['user.email'].split('@')[0],
          email: config['user.email'],
        }
      } else {
        user = {
          name: config['user.name'],
          email: '',
        }
      }
    }
  } catch (err) {
    // ignore
  }

  if (user.email.match(/\.com$/)) {
    return user
  }

  // try to read .gitconfig
  try {
    const gitFile = path.join(os.homedir(), '.gitconfig')
    const parsed = ini.parse(fs.readFileSync(gitFile, 'utf8'))
    const { name, email } = parsed.user

    if (email) {
      user = {
        name: email.split('@')[0],
        email,
      }
    } else {
      user = {
        name,
        email: '',
      }
    }
  } catch (err) {
    // empty
  }

  return user
}

function getProjectGitDir(dir: string): string | undefined {
  let cur = dir

  while (cur) {
    // 如果配置存在，说明是 .git 目录
    if (isPathExistsSync(path.join(cur, '.git', 'config'))) {
      return path.join(cur, '.git')
    }

    const parent = path.dirname(cur)

    if (parent === cur) {
      break
    } else {
      cur = parent
    }
  }
}
