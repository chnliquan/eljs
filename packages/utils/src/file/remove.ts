import { rimraf, rimrafSync } from 'rimraf'

/**
 * 删除文件（夹）
 * @param path 文件路径
 */
export function remove(path: string): Promise<boolean> {
  return rimraf(path)
}

/**
 * 删除文件（夹）
 * @param path 文件路径
 */
export function removeSync(path: string): boolean {
  return rimrafSync(path)
}
