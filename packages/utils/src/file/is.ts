import { statPath, statPathSync } from './stat'

/**
 * 是否是文件
 * @param file - 文件路径
 */
export async function isFile(file: string): Promise<boolean> {
  try {
    return (await statPath(file)).isFile()
  } catch (_) {
    return false
  }
}

/**
 * 是否是文件
 * @param file - 文件路径
 */
export function isFileSync(file: string): boolean {
  try {
    return statPathSync(file).isFile()
  } catch (_) {
    return false
  }
}

/**
 * 是否是文件夹
 * @param path - 文件夹路径
 */
export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await statPath(path)).isDirectory()
  } catch (_) {
    return false
  }
}

/**
 * 是否是文件夹
 * @param path - 文件夹路径
 */
export function isDirectorySync(path: string): boolean {
  try {
    return statPathSync(path).isDirectory()
  } catch (_) {
    return false
  }
}

/**
 * 是否是符号链接
 * @param link - 链接路径
 */
export async function isSymlink(link: string): Promise<boolean> {
  try {
    return (await statPath(link, true)).isSymbolicLink()
  } catch (_) {
    return false
  }
}

/**
 * 是否是符号链接
 * @param link - 链接路径
 */
export function isSymlinkSync(link: string): boolean {
  try {
    return statPathSync(link, true).isSymbolicLink()
  } catch (_) {
    return false
  }
}

/**
 * 判断路径是否存在
 * @param file - 文件路径
 * @returns 路径存在时返回 `true`
 */
export async function pathExists(file: string): Promise<boolean> {
  try {
    await statPath(file)
    return true
  } catch (_) {
    return false
  }
}

/**
 * 同步判断路径是否存在
 * @param file - 文件路径
 * @returns 路径存在时返回 `true`
 */
export function pathExistsSync(file: string): boolean {
  try {
    statPathSync(file)
    return true
  } catch (_) {
    return false
  }
}
