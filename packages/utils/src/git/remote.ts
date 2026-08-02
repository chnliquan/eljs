import ini from 'ini'
import path from 'node:path'

import { URL } from 'node:url'
import { pathExists, pathExistsSync, readFile, readFileSync } from '../file'
import { getProjectGitDir, getProjectGitDirSync } from './directory'

/**
 * Git 远程仓库信息
 */
export interface GitRemoteRepository {
  /** Git 仓库名称 */
  name: string

  /** Git 仓库所属的组 */
  group: string

  /** Git 仓库网页地址 */
  href: string

  /** Git HTTPS 地址 */
  https: string

  /** Git SSH 地址 */
  ssh: string
}

/**
 * 获取 Git origin 地址
 * @param cwd - 当前工作目录
 * @param exact - 是否仅检查当前目录
 * @returns origin 地址，未找到或配置无法读取时返回空字符串
 */
export async function getGitUrl(cwd: string, exact?: boolean): Promise<string> {
  const gitDir = exact
    ? path.join(cwd, '.git')
    : (await getProjectGitDir(cwd)) || ''

  if (!(await pathExists(gitDir))) {
    return ''
  }

  try {
    const parsed = ini.parse(await readFile(path.join(gitDir, 'config')))
    if (parsed['remote "origin"']) {
      return parsed['remote "origin"'].url
    }
  } catch {
    // 配置缺失或格式无效时按未配置 origin 处理
  }

  return ''
}

/**
 * 同步获取 Git origin 地址
 * @param cwd - 当前工作目录
 * @param exact - 是否仅检查当前目录
 * @returns origin 地址，未找到或配置无法读取时返回空字符串
 */
export function getGitUrlSync(cwd: string, exact?: boolean): string {
  const gitDir = exact
    ? path.join(cwd, '.git')
    : getProjectGitDirSync(cwd) || ''

  if (!pathExistsSync(gitDir)) {
    return ''
  }

  try {
    const parsed = ini.parse(readFileSync(path.join(gitDir, 'config')))
    if (parsed['remote "origin"']) {
      return parsed['remote "origin"'].url
    }
  } catch {
    // 配置缺失或格式无效时按未配置 origin 处理
  }

  return ''
}

/**
 * 解析 Git 远程地址
 * @param url - Git SSH 或 HTTP(S) 地址
 * @returns 标准化的远程仓库信息，无法解析时返回 `null`
 */
export function parseGitRemoteUrl(url: string): GitRemoteRepository | null {
  if (!url) {
    return null
  }

  try {
    let repo = ''
    let hostname = ''

    if (url.startsWith('git')) {
      const pieces = url.split(':')
      hostname = pieces[0].split('@')[1]
      repo = pieces[1].replace(/\.git$/, '')
    } else if (url.startsWith('http')) {
      const parsedUrl = new URL(url)
      hostname = parsedUrl.hostname || ''
      repo = parsedUrl.pathname?.slice(1)?.replace(/\.git$/, '') || ''
    } else {
      return null
    }

    let group = ''
    let name = ''

    repo.split('/').forEach((segment, index, segments) => {
      if (index === segments.length - 1) {
        name = segment
      } else {
        group += `/${segment}`
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
  } catch {
    return null
  }
}
