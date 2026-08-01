import ini from 'ini'
import { EOL } from 'node:os'
import path from 'node:path'

import { pathExists, pathExistsSync, readFile, readFileSync } from '../file'
import { getProjectGitDir, getProjectGitDirSync } from './directory'
import { parseGitRemoteUrl, type GitRemoteRepository } from './remote'

/**
 * Git 仓库信息
 */
export interface GitRepository extends GitRemoteRepository {
  /** Git 仓库分支 */
  branch: string

  /** Git 仓库作者 */
  author: string

  /** Git 仓库作者邮箱 */
  email: string
}

/**
 * 获取指定目录的 Git 仓库信息
 * @param dir - 文件目录
 * @param exact - 是否仅检查当前目录
 * @returns 仓库信息，未找到或配置无法读取时返回 `null`
 */
export async function getGitRepository(
  dir: string,
  exact?: boolean,
): Promise<GitRepository | null> {
  const gitDir = exact
    ? path.join(dir, '.git')
    : (await getProjectGitDir(dir)) || ''

  if (!(await pathExists(gitDir))) {
    return null
  }

  const gitRepo = createEmptyGitRepository()

  try {
    const config = ini.parse(await readFile(path.join(gitDir, 'config')))
    if (config['remote "origin"']) {
      gitRepo.ssh = config['remote "origin"'].url

      if (gitRepo.ssh) {
        Object.assign(gitRepo, parseGitRemoteUrl(gitRepo.ssh))
      }
    }

    if (config.user) {
      gitRepo.author = config.user.name
      gitRepo.email = config.user.email
    }

    const gitHead = await readFile(path.join(gitDir, 'HEAD'))
    gitRepo.branch = gitHead.replace('ref: refs/heads/', '').replace(EOL, '')
  } catch {
    return null
  }

  return gitRepo
}

/**
 * 同步获取指定目录的 Git 仓库信息
 * @param dir - 文件目录
 * @param exact - 是否仅检查当前目录
 * @returns 仓库信息，未找到或配置无法读取时返回 `null`
 */
export function getGitRepositorySync(
  dir: string,
  exact?: boolean,
): GitRepository | null {
  const gitDir = exact
    ? path.join(dir, '.git')
    : getProjectGitDirSync(dir) || ''

  if (!pathExistsSync(gitDir)) {
    return null
  }

  const gitRepo = createEmptyGitRepository()

  try {
    const config = ini.parse(readFileSync(path.join(gitDir, 'config')))
    if (config['remote "origin"']) {
      gitRepo.ssh = config['remote "origin"'].url

      if (gitRepo.ssh) {
        Object.assign(gitRepo, parseGitRemoteUrl(gitRepo.ssh))
      }
    }

    if (config.user) {
      gitRepo.author = config.user.name
      gitRepo.email = config.user.email
    }

    const gitHead = readFileSync(path.join(gitDir, 'HEAD'))
    gitRepo.branch = gitHead.replace('ref: refs/heads/', '').replace(EOL, '')
  } catch {
    return null
  }

  return gitRepo
}

function createEmptyGitRepository(): GitRepository {
  return {
    name: '',
    group: '',
    href: '',
    https: '',
    ssh: '',
    branch: '',
    author: '',
    email: '',
  }
}
