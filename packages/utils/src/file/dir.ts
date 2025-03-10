import { PLATFORM } from '@/constants'
import { mkdirp, mkdirpSync } from 'mkdirp'
import os from 'node:os'
import path from 'node:path'
import util from 'node:util'

import { isPathExists, isPathExistsSync } from './is'

/**
 * 创建文件夹
 * @param dir 文件夹路径
 * @param mode 文件夹类型
 */
export function mkdirSync(dir: string, mode?: number | string): string | void {
  if (!isPathExistsSync(dir)) {
    return mkdirpSync(dir, mode)
  }
}

/**
 * 异步创建文件夹
 * @param dir 文件夹路径
 * @param mode 文件夹类型
 */
export async function mkdir(
  dir: string,
  mode?: number | string,
): Promise<string | void> {
  if (!(await isPathExists(dir))) {
    return mkdirp(dir, mode)
  }
}

const DEFAULT_TEMP_DIR = '.cli_tmp'

/**
 * 创建临时文件夹
 * @param random 是否随机生成
 */
export function tmpdirSync(random?: boolean): string {
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

/**
 * 创建临时文件夹
 * @param random 是否随机生成
 */
export async function tmpdir(random?: boolean): Promise<string> {
  let tmpdir = ''

  if (process.platform === PLATFORM.WIN) {
    tmpdir = os.tmpdir()
  } else {
    tmpdir = path.join(process.env.HOME || os.homedir(), DEFAULT_TEMP_DIR)

    try {
      await mkdir(tmpdir)
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
    await mkdir(tmpdir)

    return tmpdir
  }

  return tmpdir
}
