import fs from 'fs'
import { isPathExistSync } from './is'
import { removeSync } from './remove'

/**
 * 移动文件
 * @param src 原路径
 * @param dest 目标路径
 * @param overwrite 是否覆盖
 */
export function moveSync(src: string, dest: string, overwrite?: boolean): void {
  if (overwrite) {
    removeSync(dest)
    fs.renameSync(src, dest)
    return
  }

  if (isPathExistSync(dest)) {
    throw Error(`The dest ${dest} already exists.`)
  } else {
    fs.renameSync(src, dest)
  }
}
