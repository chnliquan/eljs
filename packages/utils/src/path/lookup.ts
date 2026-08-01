import { pathExists, pathExistsSync } from '../file'

/**
 * 查找首个存在的路径
 * @param paths - 路径数组
 * @returns 首个存在的路径，未找到时返回 `undefined`
 */
export async function findExistingPath(
  paths: string[],
): Promise<string | undefined> {
  for (const path of paths) {
    if (await pathExists(path)) {
      return path
    }
  }
}

/**
 * 同步查找首个存在的路径
 * @param paths - 路径数组
 * @returns 首个存在的路径，未找到时返回 `undefined`
 */
export function findExistingPathSync(paths: string[]): string | undefined {
  for (const path of paths) {
    if (pathExistsSync(path)) {
      return path
    }
  }
}

/**
 * 查找首个存在的路径
 * @param paths - 路径数组
 * @returns 首个存在的路径，未找到时返回 `undefined`
 * @deprecated 请改用 {@link findExistingPath}
 */
export function tryPaths(paths: string[]): Promise<string | undefined> {
  return findExistingPath(paths)
}

/**
 * 同步查找首个存在的路径
 * @param paths - 路径数组
 * @returns 首个存在的路径，未找到时返回 `undefined`
 * @deprecated 请改用 {@link findExistingPathSync}
 */
export function tryPathsSync(paths: string[]): string | undefined {
  return findExistingPathSync(paths)
}
