import { mkdirp, mkdirpSync } from 'mkdirp'
import os from 'node:os'
import path from 'node:path'
import util from 'node:util'

import { PLATFORM } from '../constants'
import { isBoolean } from '../type'
import { isPathExists, isPathExistsSync } from './is'

/**
 * 创建文件夹
 * @param path 文件夹路径
 * @param mode 文件夹类型
 */
export async function mkdir(
  path: string,
  mode?: number | string,
): Promise<string | void | undefined> {
  if (!(await isPathExists(path))) {
    try {
      const dir = await mkdirp(path, mode)
      return dir
    } catch (error) {
      const err = error as Error
      err.message = `Create directory ${path} failed: ${err.message}`
      throw err
    }
  }
}

/**
 * 创建文件夹
 * @param path 文件夹路径
 * @param mode 文件夹类型
 */
export function mkdirSync(
  path: string,
  mode?: number | string,
): string | void | undefined {
  if (!isPathExistsSync(path)) {
    try {
      return mkdirpSync(path, mode)
    } catch (error) {
      const err = error as Error
      err.message = `Create directory ${path} failed: ${err.message}`
      throw err
    }
  }
}

const DEFAULT_TEMP_DIR = '.cli_tmp'

/**
 * 创建临时文件夹
 * @param random 是否随机生成
 */
export async function tmpdir(random?: boolean): Promise<string>
/**
 * 创建临时文件夹
 * @param dirname 文件夹名称
 * @param random 是否随机生成
 */
export async function tmpdir(dirname: string, random?: boolean): Promise<string>
export async function tmpdir(
  dirname?: string | boolean,
  random?: boolean,
): Promise<string> {
  if (isBoolean(dirname)) {
    random = dirname
    dirname = ''
  }

  let tmpdir = ''

  if (process.platform === PLATFORM.WIN) {
    tmpdir = os.tmpdir()
  } else {
    tmpdir = path.join(
      process.env.HOME || os.homedir(),
      dirname || DEFAULT_TEMP_DIR,
    )

    try {
      await mkdir(tmpdir)
    } catch (_) {
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

/**
 * 创建临时文件夹
 * @param random 是否随机生成
 */
export async function tmpdirSync(random?: boolean): Promise<string>
/**
 * 创建临时文件夹
 * @param dirname 文件夹名称
 * @param random 是否随机生成
 */
export async function tmpdirSync(
  dirname: string,
  random?: boolean,
): Promise<string>
export async function tmpdirSync(
  dirname?: string | boolean,
  random?: boolean,
): Promise<string> {
  if (isBoolean(dirname)) {
    random = dirname
    dirname = ''
  }

  let tmpdir = ''

  if (process.platform === PLATFORM.WIN) {
    tmpdir = os.tmpdir()
  } else {
    tmpdir = path.join(
      process.env.HOME || os.homedir(),
      dirname || DEFAULT_TEMP_DIR,
    )

    try {
      mkdirSync(tmpdir)
    } catch (_) {
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
