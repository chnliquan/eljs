import fs from 'node:fs'
import fsp from 'node:fs/promises'

import { isPathExists, isPathExistsSync } from './is'
import { remove, removeSync } from './remove'

/**
 * 移动文件
 * @param from 源路径
 * @param to 目标路径
 * @param overwrite 是否覆盖
 */
export function moveSync(from: string, to: string, overwrite?: boolean): void {
  if (overwrite) {
    removeSync(to)
    fs.renameSync(from, to)
    return
  }

  if (isPathExistsSync(to)) {
    throw Error(`The dest ${to} already exists.`)
  } else {
    fs.renameSync(from, to)
  }
}

/**
 * 移动文件
 * @param from 源路径
 * @param to 目标路径
 * @param overwrite 是否覆盖
 */
export async function move(
  from: string,
  to: string,
  overwrite?: boolean,
): Promise<void> {
  if (overwrite) {
    await remove(to)
    await fsp.rename(from, to)
    return
  }

  if (await isPathExists(to)) {
    throw Error(`The dest ${to} already exists.`)
  } else {
    await fsp.rename(from, to)
  }
}
