import fs from 'node:fs'
import fsp from 'node:fs/promises'

/**
 * 获取文件信息
 * @param file 文件路径
 * @param symlink 是否符号链接
 */
export async function fstat(
  file: string,
  symlink?: boolean,
): Promise<fs.Stats> {
  try {
    const stat = await (symlink ? fsp.lstat(file) : fsp.stat(file))
    return stat
  } catch (error) {
    const err = error as Error
    err.message = `Stat ${file} failed: ${err.message}`
    throw err
  }
}

/**
 * 获取文件信息
 * @param file 文件路径
 * @param symlink 是否符号链接
 */
export function fstatSync(file: string, symlink?: boolean): fs.Stats | boolean {
  try {
    return symlink ? fs.lstatSync(file) : fs.statSync(file)
  } catch (error) {
    const err = error as Error
    err.message = `Stat ${file} failed: ${err.message}`
    throw err
  }
}
