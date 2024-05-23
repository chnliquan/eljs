import mkdirp from 'mkdirp'
import os from 'os'
import path from 'path'
import util from 'util'

import { PLATFORM } from '../constants'
import { isPathExist, isPathExistSync } from './is'

/**
 * 同步创建文件夹
 * @param dir 文件夹路径
 * @param mode 文件夹类型
 */
export function mkdirSync(dir: string, mode?: mkdirp.Mode): string {
  if (!isPathExistSync(dir)) {
    return mkdirp.sync(dir, mode) as string
  }

  return ''
}

/**
 * 异步创建文件夹
 * @param dir 文件夹路径
 * @param mode 文件夹类型
 */
export async function mkdir(dir: string, mode?: mkdirp.Mode): Promise<string> {
  if (!(await isPathExist(dir))) {
    return mkdirp(dir, mode) as Promise<string>
  }

  return Promise.resolve('')
}

const DEFAULT_TEMP_DIR = '.cli_tmp'

/**
 * 创建临时文件夹
 * @param random 是否随机生成
 */
export function tmpdir(random?: boolean): string {
  let tmpdir = ''

  if (process.platform === PLATFORM.WIN) {
    tmpdir = os.tmpdir()
  } else {
    tmpdir = path.join(process.env.HOME || os.homedir(), DEFAULT_TEMP_DIR)

    try {
      mkdirSync(tmpdir)
    } catch (err) {
      tmpdir = os.tmpdir()
    }
  }

  if (random) {
    const name = util.format(
      'tmp-%s-%s',
      Date.now(),
      Math.ceil(Math.random() * 1000),
    )

    tmpdir = path.join(tmpdir, name)
    mkdirSync(tmpdir)

    return tmpdir
  }

  return tmpdir
}
