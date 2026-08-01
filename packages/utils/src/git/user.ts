import { execa, execaSync } from 'execa'
import ini from 'ini'
import os, { EOL } from 'node:os'
import path from 'node:path'

import { readFile, readFileSync } from '../file'

/**
 * Git 用户信息
 */
export interface GitUser {
  /** 用户名 */
  name: string

  /** 用户邮箱 */
  email: string
}

/**
 * 获取 Git 用户
 * @returns Git 配置中的用户信息，无法读取时返回空字段
 */
export async function getGitUser(): Promise<GitUser> {
  let user = createEmptyGitUser()

  try {
    const gitConfig = (await execa('git', ['config', '--list'])).stdout

    if (gitConfig) {
      user = parseGitUserConfig(gitConfig)
    }
  } catch {
    // Git 命令不可用时继续读取用户级配置文件
  }

  if (user.email.match(/\.com$/)) {
    return user
  }

  try {
    user = parseGitConfigFile(
      await readFile(path.join(os.homedir(), '.gitconfig')),
    )
  } catch {
    // 用户级配置不可读时保留前一步得到的结果
  }

  return user
}

/**
 * 同步获取 Git 用户
 * @returns Git 配置中的用户信息，无法读取时返回空字段
 */
export function getGitUserSync(): GitUser {
  let user = createEmptyGitUser()

  try {
    const gitConfig = execaSync('git', ['config', '--list']).stdout

    if (gitConfig) {
      user = parseGitUserConfig(gitConfig)
    }
  } catch {
    // Git 命令不可用时继续读取用户级配置文件
  }

  if (user.email.match(/\.com$/)) {
    return user
  }

  try {
    user = parseGitConfigFile(
      readFileSync(path.join(os.homedir(), '.gitconfig')),
    )
  } catch {
    // 用户级配置不可读时保留前一步得到的结果
  }

  return user
}

function createEmptyGitUser(): GitUser {
  return { name: '', email: '' }
}

function parseGitUserConfig(gitConfig: string): GitUser {
  const config: Record<string, string> = Object.create(null)

  gitConfig.split(EOL).forEach(line => {
    const [key, value] = line.split('=')
    config[key] = value
  })

  if (config['user.email']) {
    return {
      name: config['user.email'].split('@')[0],
      email: config['user.email'],
    }
  }

  return { name: config['user.name'], email: '' }
}

function parseGitConfigFile(content: string): GitUser {
  const parsed = ini.parse(content)
  const { name, email } = parsed.user

  if (email) {
    return { name: email.split('@')[0], email }
  }

  return { name, email: '' }
}
