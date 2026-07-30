import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { EOL } from 'node:os'
import { v4 } from 'uuid'

import { isPathExists, isPathExistsSync } from './is'

/**
 * 写入文件内容
 * @param path 文件路径
 * @param content 文件内容
 * @param encoding 文件编码
 */
export async function writeFile(
  path: string,
  content: string,
  encoding: BufferEncoding = 'utf8',
): Promise<void> {
  try {
    await fsp.writeFile(path, content, encoding)
  } catch (error) {
    const err = error as Error
    err.message = `Write ${path} failed: ${err.message}`
    throw err
  }
}

/**
 * 写入文件内容
 * @param path 文件路径
 * @param content 文件内容
 * @param encoding 文件编码
 */
export function writeFileSync(
  path: string,
  content: string,
  encoding: BufferEncoding = 'utf8',
): void {
  try {
    fs.writeFileSync(path, content, encoding)
  } catch (error) {
    const err = error as Error
    err.message = `Write ${path} failed: ${err.message}`
    throw err
  }
}

/**
 * 安全写入文件
 * @param path 文件路径
 * @param content 文件内容
 * @param encoding 文件编码
 */
export async function safeWriteFile(
  path: string,
  content: string,
  encoding: BufferEncoding = 'utf8',
): Promise<void> {
  const tmpFile = `${path}.${v4()}-tmp`

  try {
    await writeFile(tmpFile, content, encoding)
    await fsp.rename(tmpFile, path)
  } catch (error) {
    // 如果发生异常, 就将 tmpFile 删除掉
    if (await isPathExists(tmpFile)) {
      await fsp.unlink(tmpFile)
    }

    throw error
  }
}

/**
 * 安全写入文件
 * @param path 文件路径
 * @param content 文件内容
 * @param encoding 文件编码
 */
export function safeWriteFileSync(
  path: string,
  content: string,
  encoding: BufferEncoding = 'utf8',
): void {
  const tmpFile = `${path}.${v4()}-tmp`

  try {
    writeFileSync(tmpFile, content, encoding)
    fs.renameSync(tmpFile, path)
  } catch (error) {
    // 如果发生异常, 就将 tmpFile 删除掉
    if (isPathExistsSync(tmpFile)) {
      fs.unlinkSync(tmpFile)
    }

    throw error
  }
}

/**
 * 写入 Json 文件
 * @param path 文件路径
 * @param content 文件内容
 */
export async function writeJson<T extends object>(
  path: string,
  content: T,
): Promise<void> {
  try {
    await fsp.writeFile(path, JSON.stringify(content, null, 2) + EOL)
  } catch (error) {
    const err = error as Error
    err.message = `Write ${path} failed: ${err.message}`
    throw err
  }
}

/**
 * 写入 Json 文件
 * @param path 文件路径
 * @param content 文件内容
 */
export function writeJsonSync<T extends object>(
  path: string,
  content: T,
): void {
  try {
    fs.writeFileSync(path, JSON.stringify(content, null, 2) + EOL)
  } catch (error) {
    const err = error as Error
    err.message = `Write ${path} failed: ${err.message}`
    throw err
  }
}

/**
 * 安全写入 Json 文件
 * @param path 文件路径
 * @param data 文件内容
 */
export async function safeWriteJson<T extends object>(
  path: string,
  data: T,
): Promise<void> {
  const tmpFile = `${path}.${v4()}-tmp`

  try {
    await writeJson(tmpFile, data)
    await fsp.rename(tmpFile, path)
  } catch (error) {
    // 如果发生异常, 就将 tmpFile 删除掉
    if (await isPathExists(tmpFile)) {
      await fsp.unlink(tmpFile)
    }

    throw error
  }
}

/**
 * 安全写入 Json 文件
 * @param file 文件路径
 * @param data 文件内容
 */
export function safeWriteJsonSync<T extends object>(
  path: string,
  data: T,
): void {
  const tmpFile = `${path}.${v4()}-tmp`

  try {
    writeJsonSync(tmpFile, data)
    fs.renameSync(tmpFile, path)
  } catch (error) {
    // 如果发生异常, 就将 tmpFile 删除掉
    if (isPathExistsSync(tmpFile)) {
      fs.unlinkSync(tmpFile)
    }

    throw error
  }
}
