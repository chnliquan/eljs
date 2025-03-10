import fs from 'node:fs'
import fsp from 'node:fs/promises'

/**
 * 是否是文件
 * @param file 文件路径
 */
export function isFileSync(file: string): boolean {
  const stat = fstatSync(file) as fs.Stats
  return stat ? stat.isFile() : false
}

/**
 * 是否是文件
 * @param file 文件路径
 */
export async function isFile(file: string): Promise<boolean> {
  const stat = (await fstat(file)) as fs.Stats
  return stat ? stat.isFile() : false
}

/**
 * 是否是文件夹
 * @param dir 文件路径夹
 */
export function isDirectorySync(dir: string): boolean {
  const stat = fstatSync(dir) as fs.Stats
  return stat ? stat.isDirectory() : false
}

/**
 * 是否是文件夹
 * @param dir 文件路径夹
 */
export async function isDirectory(dir: string): Promise<boolean> {
  const stat = (await fstat(dir)) as fs.Stats
  return stat ? stat.isDirectory() : false
}

/**
 * 是否是符号链接
 * @param link 链接路径
 */
export function isSymlinkSync(link: string): boolean {
  const stat = fstatSync(link, true) as fs.Stats
  return stat ? stat.isSymbolicLink() : false
}

/**
 * 是否是符号链接
 * @param link 链接路径
 */
export async function isSymlink(link: string): Promise<boolean> {
  const stat = (await fstat(link, true)) as fs.Stats
  return stat ? stat.isSymbolicLink() : false
}

/**
 * 指定路径是否存在
 * @param file 文件路径
 */
export function isPathExistsSync(file: string): boolean {
  return Boolean(fstatSync(file))
}

/**
 * 指定路径是否存在
 * @param file 文件路径
 */
export async function isPathExists(file: string): Promise<boolean> {
  return fstat(file).then(Boolean)
}

export function fstatSync(file: string, symlink?: boolean): fs.Stats | boolean {
  try {
    return symlink ? fs.lstatSync(file) : fs.statSync(file)
  } catch (err) {
    return false
  }
}

export async function fstat(
  file: string,
  symlink?: boolean,
): Promise<fs.Stats | boolean> {
  try {
    const stat = await (symlink ? fsp.lstat(file) : fsp.stat(file))
    return stat
  } catch (err) {
    return false
  }
}
