import deepmerge from 'deepmerge'
import fs from 'fs'
import path from 'path'
import { v4 } from 'uuid'
import { PkgJSON } from '../types'
import { isPathExists, isPathExistsSync } from './is'
import { readJSON, readJSONSync } from './read'

const fsp = fs.promises

/**
 * 写入 JSON 文件
 * @param file 文件路径
 * @param content 文件内容
 */
export function writeJSONSync<T extends Record<string, unknown>>(
  file: string,
  content: T,
): void {
  fs.writeFileSync(file, JSON.stringify(content, null, 2) + '\n')
}

/**
 * 写入 JSON 文件
 * @param file 文件路径
 * @param content 文件内容
 */
export function writeJSON<T extends Record<string, unknown>>(
  file: string,
  content: T,
): Promise<void> {
  return fsp.writeFile(file, JSON.stringify(content, null, 2) + '\n')
}

/**
 * 更新指定文件夹下的 package.json 文件
 * @param json 文件内容
 * @param dir 文件夹路径
 */
export function updatePkgJSONSync(
  json: Partial<PkgJSON>,
  dir = process.cwd(),
): void {
  const pkgJSONPath = path.resolve(dir, 'package.json')
  const pkgJSON = readJSONSync(pkgJSONPath)
  const pkg = deepmerge(pkgJSON, json)

  safeWriteJSONSync(pkgJSONPath, pkg)
}

/**
 * 更新指定文件夹下的 package.json 文件
 * @param json 文件内容
 * @param dir 文件夹路径
 */
export async function updatePkgJSON(
  json: Partial<PkgJSON>,
  dir = process.cwd(),
): Promise<void> {
  const pkgJSONPath = path.resolve(dir, 'package.json')
  const pkgJSON = await readJSON(pkgJSONPath)
  const pkg = deepmerge(pkgJSON, json)

  await safeWriteJSON(pkgJSONPath, pkg)
}

/**
 * 安全写入 JSON 文件
 * @param file 文件路径
 * @param json 文件内容
 */
export function safeWriteJSONSync<T extends Record<string, unknown>>(
  file: string,
  json: T,
): void {
  const tmpFile = `${file}.${v4()}-tmp`

  try {
    writeJSONSync(tmpFile, json)
    fs.renameSync(tmpFile, file)
  } catch (err) {
    // 如果发生异常, 就将 tmpFile 删除掉
    if (isPathExistsSync(tmpFile)) {
      fs.unlinkSync(tmpFile)
    }
  }
}

/**
 * 安全写入 JSON 文件
 * @param file 文件路径
 * @param json 文件内容
 */
export async function safeWriteJSON<T extends Record<string, unknown>>(
  file: string,
  json: T,
): Promise<void> {
  const tmpFile = `${file}.${v4()}-tmp`

  try {
    await writeJSON(tmpFile, json)
    await fsp.rename(tmpFile, file)
  } catch (err) {
    // 如果发生异常, 就将 tmpFile 删除掉
    if (await isPathExists(tmpFile)) {
      await fsp.unlink(tmpFile)
    }
  }
}

/**
 * 写入文件内容
 * @param file 文件路径
 * @param content 文件内容
 * @param encoding 文件编码
 */
export function writeFileSync(
  file: string,
  content: string,
  encoding: BufferEncoding = 'utf-8',
): void {
  fs.writeFileSync(file, content, encoding)
}

/**
 * 写入文件内容
 * @param file 文件路径
 * @param content 文件内容
 * @param encoding 文件编码
 */
export async function writeFile(
  file: string,
  content: string,
  encoding: BufferEncoding = 'utf-8',
): Promise<void> {
  await fsp.writeFile(file, content, encoding)
}

/**
 * 安全写入文件
 * @param file 文件路径
 * @param content 文件内容
 * @param encoding 文件编码
 */
export function safeWriteFileSync(
  file: string,
  content: string,
  encoding: BufferEncoding = 'utf-8',
): void {
  const tmpFile = `${file}.${v4()}-tmp`

  try {
    writeFileSync(tmpFile, content, encoding)
    fs.renameSync(tmpFile, file)
  } catch (err) {
    // 如果发生异常, 就将 tmpFile 删除掉
    if (isPathExistsSync(tmpFile)) {
      fs.unlinkSync(tmpFile)
    }
  }
}

/**
 * 安全写入文件
 * @param file 文件路径
 * @param content 文件内容
 * @param encoding 文件编码
 */
export async function safeWriteFile(
  file: string,
  content: string,
  encoding: BufferEncoding = 'utf-8',
): Promise<void> {
  const tmpFile = `${file}.${v4()}-tmp`

  try {
    await writeFile(tmpFile, content, encoding)
    await fsp.rename(tmpFile, file)
  } catch (err) {
    // 如果发生异常, 就将 tmpFile 删除掉
    if (await isPathExists(tmpFile)) {
      await fsp.unlink(tmpFile)
    }
  }
}
