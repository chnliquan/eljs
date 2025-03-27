import fs from 'node:fs'

import { fstat, fstatSync } from './meta'

/**
 * 是否是文件
 * @param file 文件路径
 */
export async function isFile(file: string): Promise<boolean> {
  try {
    const stat = (await fstat(file)) as fs.Stats
    return stat ? stat.isFile() : false
  } catch (_) {
    return false
  }
}

/**
 * 是否是文件
 * @param file 文件路径
 */
export function isFileSync(file: string): boolean {
  try {
    const stat = fstatSync(file) as fs.Stats
    return stat ? stat.isFile() : false
  } catch (_) {
    return false
  }
}

/**
 * 是否是文件夹
 * @param path 文件夹路径
 */
export async function isDirectory(path: string): Promise<boolean> {
  try {
    const stat = (await fstat(path)) as fs.Stats
    return stat ? stat.isDirectory() : false
  } catch (_) {
    return false
  }
}

/**
 * 是否是文件夹
 * @param path 文件夹路径
 */
export function isDirectorySync(path: string): boolean {
  try {
    const stat = fstatSync(path) as fs.Stats
    return stat ? stat.isDirectory() : false
  } catch (_) {
    return false
  }
}

/**
 * 是否是符号链接
 * @param link 链接路径
 */
export async function isSymlink(link: string): Promise<boolean> {
  try {
    const stat = (await fstat(link, true)) as fs.Stats
    return stat ? stat.isSymbolicLink() : false
  } catch (_) {
    return false
  }
}

/**
 * 是否是符号链接
 * @param link 链接路径
 */
export function isSymlinkSync(link: string): boolean {
  try {
    const stat = fstatSync(link, true) as fs.Stats
    return stat ? stat.isSymbolicLink() : false
  } catch (_) {
    return false
  }
}

/**
 * 路径是否存在
 * @param file 文件路径
 */
export async function isPathExists(file: string): Promise<boolean> {
  try {
    const stat = await fstat(file)
    return Boolean(stat)
  } catch (_) {
    return false
  }
}

/**
 * 路径是否存在
 * @param file 文件路径
 */
export function isPathExistsSync(file: string): boolean {
  try {
    const stat = fstatSync(file)
    return Boolean(stat)
  } catch (_) {
    return false
  }
}
