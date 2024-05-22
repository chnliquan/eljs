import fs from 'fs'

/**
 * 是否是文件
 * @param file 文件路径
 */
export function isFile(file: string): boolean {
  const stat = fstatSync(file) as fs.Stats
  return stat ? stat.isFile() : false
}

/**
 * 是否是文件夹
 * @param dir 文件路径夹
 */
export function isDirectory(dir: string): boolean {
  const stat = fstatSync(dir) as fs.Stats
  return stat ? stat.isDirectory() : false
}

/**
 * 是否是符号链接
 * @param link 链接路径
 */
export function isSymlink(link: string): boolean {
  const stat = fstatSync(link, true) as fs.Stats
  return stat ? stat.isSymbolicLink() : false
}

/**
 * 文件是否存在
 * @param file 文件路径
 */
export function existsSync(file: string): boolean {
  return !!fstatSync(file)
}

function fstatSync(file: string, symlink?: boolean): fs.Stats | boolean {
  try {
    return symlink ? fs.lstatSync(file) : fs.statSync(file)
  } catch (err) {
    return false
  }
}
