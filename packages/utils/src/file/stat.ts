import fs from 'node:fs'
import fsp from 'node:fs/promises'

/**
 * 获取路径状态
 * @param file - 文件路径
 * @param symlink - 是否读取符号链接自身的状态
 * @returns 路径状态
 * @throws 当路径不存在或无法访问时抛出包含路径上下文的错误
 */
export async function statPath(
  file: string,
  symlink?: boolean,
): Promise<fs.Stats> {
  try {
    return await (symlink ? fsp.lstat(file) : fsp.stat(file))
  } catch (error) {
    const err = error as Error
    err.message = `Stat ${file} failed: ${err.message}`
    throw err
  }
}

/**
 * 同步获取路径状态
 * @param file - 文件路径
 * @param symlink - 是否读取符号链接自身的状态
 * @returns 路径状态
 * @throws 当路径不存在或无法访问时抛出包含路径上下文的错误
 */
export function statPathSync(file: string, symlink?: boolean): fs.Stats {
  try {
    return symlink ? fs.lstatSync(file) : fs.statSync(file)
  } catch (error) {
    const err = error as Error
    err.message = `Stat ${file} failed: ${err.message}`
    throw err
  }
}

/**
 * 获取路径状态
 * @param file - 文件路径
 * @param symlink - 是否读取符号链接自身的状态
 * @returns 路径状态
 * @deprecated 请改用 {@link statPath}
 */
export function fstat(file: string, symlink?: boolean): Promise<fs.Stats> {
  return statPath(file, symlink)
}

/**
 * 同步获取路径状态
 * @param file - 文件路径
 * @param symlink - 是否读取符号链接自身的状态
 * @returns 路径状态
 * @deprecated 请改用 {@link statPathSync}
 */
export function fstatSync(file: string, symlink?: boolean): fs.Stats {
  return statPathSync(file, symlink)
}
