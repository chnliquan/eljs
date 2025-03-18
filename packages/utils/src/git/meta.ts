import { run, type RunCommandOptions } from '@/cp'
import { isPathExists, isPathExistsSync, readFile, readFileSync } from '@/file'
import execa from 'execa'
import ini from 'ini'
import os from 'node:os'
import path from 'node:path'
import { URL } from 'node:url'

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
   * git 网页地址
   */
  href: string
  /**
   * git https url
   */
  https: string
  /**
   * git ssh url
   */
  ssh: string
}

/**
 * git 仓库信息
 */
export interface GitRepoInfo extends BaseGitRepoInfo {
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
export function getGitUrlSync(cwd: string, exact?: boolean): string {
  const gitDir = exact
    ? path.join(cwd, '.git')
    : getProjectGitDirSync(cwd) || ''

  if (!isPathExistsSync(gitDir)) {
    return ''
  }

  try {
    const parsed = ini.parse(readFileSync(path.join(gitDir, 'config')))

    if (parsed['remote "origin"']) {
      return parsed['remote "origin"'].url
    }
  } catch (err) {
    // catch error
  }

  return ''
}

/**
 * 获取指定目录的 git 地址
 * @param cwd 当前工作目录
 * @param exact 是否在当前目录下提取
 */
export async function getGitUrl(cwd: string, exact?: boolean): Promise<string> {
  const gitDir = exact
    ? path.join(cwd, '.git')
    : (await getProjectGitDir(cwd)) || ''

  if (!(await isPathExists(gitDir))) {
    return ''
  }

  try {
    const parsed = ini.parse(await readFile(path.join(gitDir, 'config')))

    if (parsed['remote "origin"']) {
      return parsed['remote "origin"'].url
    }
  } catch (err) {
    // catch error
  }

  return ''
}

/**
 * 获取 git 分支
 * @param options 可选配置项
 */
export async function getGitBranch(
  options?: RunCommandOptions,
): Promise<string> {
  return run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], options).then(
    data => {
      return data.stdout.trim()
    },
  )
}

/**
 * 获取 git 远程分支
 * @param options 可选配置项
 */
export async function getGitUpstreamBranch(
  options?: RunCommandOptions,
): Promise<string | null> {
  try {
    const upstream = await run(
      'git',
      ['rev-parse', '--abbrev-ref', '@{u}'],
      options,
    ).then(data => {
      return data.stdout.trim()
    })
    return upstream
  } catch (err) {
    return null
  }
}

/**
 * 获取 git commit 哈希值
 * @param short 是否截断
 * @param options 可选配置项
 */
export async function getGitCommitSha(
  short?: boolean,
  options?: RunCommandOptions,
): Promise<string> {
  return run(
    'git',
    ['rev-parse', ...(short ? ['--short'] : []), 'HEAD'],
    options,
  ).then(data => {
    return data.stdout.trim()
  })
}

/**
 * 解析 git 地址
 * @param url git 地址
 */
export function gitUrlAnalysis(url: string): BaseGitRepoInfo | null {
  if (!url) {
    return null
  }

  try {
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
      https: `https://${hostname}/${group}/${name}.git`,
      ssh: `git@${hostname}:${group}/${name}.git`,
    }
  } catch (err) {
    return null
  }
}

/**
 * 获取指定目录的 git 仓库信息
 * @param dir 文件目录
 * @param exact 是否在当前目录下提取
 */
export function getGitRepoInfoSync(
  dir: string,
  exact?: boolean,
): GitRepoInfo | null {
  const gitDir = exact
    ? path.join(dir, '.git')
    : getProjectGitDirSync(dir) || ''

  if (!isPathExistsSync(gitDir)) {
    return null
  }

  const gitRepoInfo: GitRepoInfo = {
    name: '',
    group: '',
    href: '',
    https: '',
    ssh: '',
    branch: '',
    author: '',
    email: '',
  }

  try {
    const config = ini.parse(readFileSync(path.join(gitDir, 'config')))
    // remote
    if (config['remote "origin"']) {
      gitRepoInfo.ssh = config['remote "origin"'].url

      if (gitRepoInfo.ssh) {
        Object.assign(gitRepoInfo, gitUrlAnalysis(gitRepoInfo.ssh))
      }
    }

    if (config['user']) {
      gitRepoInfo.author = config['user'].name
      gitRepoInfo.email = config['user'].email
    }

    // branch
    const gitHead = readFileSync(path.join(gitDir, 'HEAD'))
    gitRepoInfo.branch = gitHead
      .replace('ref: refs/heads/', '')
      .replace('\n', '')
  } catch (err) {
    return null
  }

  return gitRepoInfo
}

/**
 * 获取指定目录的 git 仓库信息
 * @param dir 文件目录
 * @param exact 是否在当前目录下提取
 */
export async function getGitRepoInfo(
  dir: string,
  exact?: boolean,
): Promise<GitRepoInfo | null> {
  const gitDir = exact
    ? path.join(dir, '.git')
    : (await getProjectGitDir(dir)) || ''

  if (!(await isPathExists(gitDir))) {
    return null
  }

  const gitRepoInfo: GitRepoInfo = {
    name: '',
    group: '',
    href: '',
    https: '',
    ssh: '',
    branch: '',
    author: '',
    email: '',
  }

  try {
    const config = ini.parse(await readFile(path.join(gitDir, 'config')))
    // remote
    if (config['remote "origin"']) {
      gitRepoInfo.ssh = config['remote "origin"'].url

      if (gitRepoInfo.ssh) {
        Object.assign(gitRepoInfo, gitUrlAnalysis(gitRepoInfo.ssh))
      }
    }

    if (config['user']) {
      gitRepoInfo.author = config['user'].name
      gitRepoInfo.email = config['user'].email
    }

    // branch
    const gitHead = await readFile(path.join(gitDir, 'HEAD'))
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
export function getGitUserSync(): GitUser {
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
    const parsed = ini.parse(readFileSync(gitFile))
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

/**
 * 获取 git 用户
 */
export async function getGitUser(): Promise<GitUser> {
  let user: GitUser = {
    name: '',
    email: '',
  }

  // try to get config by git
  try {
    const gitConfig = (await execa('git', ['config', '--list'])).stdout

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
    const parsed = ini.parse(await readFile(gitFile))
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

/**
 * 获取工程 git 路径
 * @param dir 文件目录
 */
export function getProjectGitDirSync(dir: string): string | undefined {
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

/**
 * 获取工程 git 路径
 * @param dir 文件目录
 */
export async function getProjectGitDir(
  dir: string,
): Promise<string | undefined> {
  let cur = dir

  while (cur) {
    // 如果配置存在，说明是 .git 目录
    if (await isPathExists(path.join(cur, '.git', 'config'))) {
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
