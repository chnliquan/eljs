import path from 'node:path'

import { pathExists, pathExistsSync } from '../file'

/**
 * 查找工程的 `.git` 目录
 * @param dir - 起始目录
 * @returns 最近的 `.git` 目录，未找到时返回 `undefined`
 */
export async function getProjectGitDir(
  dir: string,
): Promise<string | undefined> {
  let currentDir = dir

  while (currentDir) {
    if (await pathExists(path.join(currentDir, '.git', 'config'))) {
      return path.join(currentDir, '.git')
    }

    const parent = path.dirname(currentDir)

    if (parent === currentDir) {
      break
    }

    currentDir = parent
  }
}

/**
 * 同步查找工程的 `.git` 目录
 * @param dir - 起始目录
 * @returns 最近的 `.git` 目录，未找到时返回 `undefined`
 */
export function getProjectGitDirSync(dir: string): string | undefined {
  let currentDir = dir

  while (currentDir) {
    if (pathExistsSync(path.join(currentDir, '.git', 'config'))) {
      return path.join(currentDir, '.git')
    }

    const parent = path.dirname(currentDir)

    if (parent === currentDir) {
      break
    }

    currentDir = parent
  }
}
