import execa from 'execa'
import { hasGlobalInstallation } from '../env'

/**
 * 是否存在 git
 */
export async function hasGit(): Promise<boolean> {
  return hasGlobalInstallation('git')
}

/**
 * 当前项目是否存在 git
 * @param cwd 当前工作目录
 */
export function hasProjectGit(cwd: string): Promise<boolean> {
  return execa('git', ['status'], {
    cwd,
  })
    .then(data => {
      return /^\d+.\d+.\d+$/.test(data.stdout)
    })
    .then(value => {
      return value
    })
    .catch(() => false)
}
