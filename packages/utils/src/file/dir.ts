import { mkdirp, mkdirpSync } from 'mkdirp'
import { mkdtemp, mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { PLATFORM } from '../constants'
import { isBoolean } from '../guards'
import { pathExists, pathExistsSync } from './is'

/**
 * 创建文件夹
 * @param path - 文件夹路径
 * @param mode - 文件夹类型
 */
export async function mkdir(
  path: string,
  mode?: number | string,
): Promise<string | void | undefined> {
  if (!(await pathExists(path))) {
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
 * @param path - 文件夹路径
 * @param mode - 文件夹类型
 */
export function mkdirSync(
  path: string,
  mode?: number | string,
): string | void | undefined {
  if (!pathExistsSync(path)) {
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
 * @param random - 是否随机生成
 * @returns 临时文件夹路径
 */
export async function createTempDir(random?: boolean): Promise<string>
/**
 * 创建临时文件夹
 * @param dirname - 文件夹名称
 * @param random - 是否随机生成
 * @returns 临时文件夹路径
 */
export async function createTempDir(
  dirname: string,
  random?: boolean,
): Promise<string>
export async function createTempDir(
  dirname?: string | boolean,
  random?: boolean,
): Promise<string> {
  if (isBoolean(dirname)) {
    random = dirname
    dirname = ''
  }

  let tempDir: string

  if (process.platform === PLATFORM.WIN) {
    tempDir = os.tmpdir()
  } else {
    tempDir = path.join(
      process.env.HOME || os.homedir(),
      dirname || DEFAULT_TEMP_DIR,
    )

    try {
      await mkdir(tempDir)
    } catch (_) {
      tempDir = os.tmpdir()
    }
  }

  if (random) {
    // mkdtemp 由操作系统原子创建私有目录，避免可预测名称被抢占或并发复用
    return new Promise<string>((resolve, reject) => {
      mkdtemp(path.join(tempDir, 'tmp-'), (error, directory) => {
        if (error) {
          reject(error)
          return
        }

        resolve(directory)
      })
    })
  }

  return tempDir
}

/**
 * 同步创建临时文件夹
 * @param random - 是否随机生成
 * @returns 临时文件夹路径
 */
export function createTempDirSync(random?: boolean): string
/**
 * 同步创建临时文件夹
 * @param dirname - 文件夹名称
 * @param random - 是否随机生成
 * @returns 临时文件夹路径
 */
export function createTempDirSync(dirname: string, random?: boolean): string
export function createTempDirSync(
  dirname?: string | boolean,
  random?: boolean,
): string {
  if (isBoolean(dirname)) {
    random = dirname
    dirname = ''
  }

  let tempDir: string

  if (process.platform === PLATFORM.WIN) {
    tempDir = os.tmpdir()
  } else {
    tempDir = path.join(
      process.env.HOME || os.homedir(),
      dirname || DEFAULT_TEMP_DIR,
    )

    try {
      mkdirSync(tempDir)
    } catch (_) {
      tempDir = os.tmpdir()
    }
  }

  if (random) {
    return mkdtempSync(path.join(tempDir, 'tmp-'))
  }

  return tempDir
}
