import execa from 'execa'

import { hasGlobalInstallation } from '@/env'

/**
 * 全局是否存在 git
 */
export async function hasGit(): Promise<boolean> {
  return hasGlobalInstallation('git')
}

/**
 * 项目是否存在 git
 * @param cwd 当前工作目录
 */
export function hasProjectGit(cwd: string): Promise<boolean> {
  return execa('git', ['status'], {
    cwd,
  })
    .then(data => {
      return Boolean(data.stdout)
    })
    .then(value => {
      return value
    })
    .catch(() => false)
}
