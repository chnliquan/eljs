import { execSync } from 'child_process'
import fs from 'fs'
import ini from 'ini'
import os from 'os'
import path from 'path'

interface Config {
  [propName: string]: string
}

export interface UserAccount {
  name: string
  email: string
}

export function getUserAccount(): UserAccount {
  let account: UserAccount = {
    name: '',
    email: '',
  }

  // try to get config by git
  try {
    const gitConfigList = execSync('git config --list').toString()

    if (gitConfigList) {
      const config: Config = {}

      gitConfigList.split(os.EOL).forEach(line => {
        const [key, value] = line.split('=')
        config[key] = value
      })

      if (config['user.email']) {
        account = {
          name: config['user.email'].split('@')[0],
          email: config['user.email'],
        }
      } else {
        account = {
          name: config['user.name'],
          email: '',
        }
      }
    }
  } catch (err) {
    // ignore
  }

  if (account.email.match(/\.com$/)) {
    return account
  }

  // try to read .gitconfig
  try {
    const gitFile = path.join(os.homedir(), '.gitconfig')
    const parsed = ini.parse(fs.readFileSync(gitFile, 'utf8'))
    const { name, email } = parsed.user

    if (email) {
      account = {
        name: email.split('@')[0],
        email,
      }
    } else {
      account = {
        name,
        email: '',
      }
    }
  } catch (err) {
    // empty
  }

  return account
}
