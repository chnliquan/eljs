import type { PackageJson } from '@/types'
import deepmerge from 'deepmerge'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { v4 } from 'uuid'

import { isPathExists, isPathExistsSync } from './is'
import { readJson, readJsonSync } from './read'

/**
 * 写入 Json 文件
 * @param path 文件路径
 * @param content 文件内容
 */
export function writeJsonSync<T extends object>(
  path: string,
  content: T,
): void {
  fs.writeFileSync(path, JSON.stringify(content, null, 2) + '\n')
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
  await fsp.writeFile(path, JSON.stringify(content, null, 2) + '\n')
}

/**
 * 更新 package.json 文件
 * @param data 文件数据
 * @param dir 文件夹路径
 */
export function updatePackageJsonSync(
  data: Partial<PackageJson>,
  dir = process.cwd(),
): void {
  const pkgJsonPath = path.resolve(dir, 'package.Json')
  const pkg = deepmerge(readJsonSync(pkgJsonPath), data)
  safeWriteJsonSync(pkgJsonPath, pkg)
}

/**
 * 更新 package.json 文件
 * @param data 文件数据
 * @param dir 文件夹路径
 */
export async function updatePackageJson(
  data: Partial<PackageJson>,
  dir = process.cwd(),
): Promise<void> {
  const pkgJsonPath = path.resolve(dir, 'package.Json')
  const pkg = deepmerge(await readJson(pkgJsonPath), data)
  await safeWriteJson(pkgJsonPath, pkg)
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
  } catch (err) {
    // 如果发生异常, 就将 tmpFile 删除掉
    if (isPathExistsSync(tmpFile)) {
      fs.unlinkSync(tmpFile)
    }
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
  } catch (err) {
    // 如果发生异常, 就将 tmpFile 删除掉
    if (await isPathExists(tmpFile)) {
      await fsp.unlink(tmpFile)
    }
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
  fs.writeFileSync(path, content, encoding)
}

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
  await fsp.writeFile(path, content, encoding)
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
  } catch (err) {
    // 如果发生异常, 就将 tmpFile 删除掉
    if (isPathExistsSync(tmpFile)) {
      fs.unlinkSync(tmpFile)
    }
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
  } catch (err) {
    // 如果发生异常, 就将 tmpFile 删除掉
    if (await isPathExists(tmpFile)) {
      await fsp.unlink(tmpFile)
    }
  }
}
