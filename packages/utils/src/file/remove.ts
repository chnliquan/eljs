import { rimraf, rimrafSync } from 'rimraf'

/**
 * 删除文件（夹）
 * @param filepath 文件路径
 */
export function removeSync(filepath: string): boolean {
  return rimrafSync(filepath)
}

/**
 * 删除文件（夹）
 * @param filepath 文件路径
 */
export function remove(filepath: string): Promise<boolean> {
  return rimraf(filepath)
}
