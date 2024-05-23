import deepmerge from 'deepmerge'
import fs from 'fs'
import path from 'path'
import { v4 } from 'uuid'
import { PkgJSON } from '../types'
import { isPathExistsSync } from './is'
import { readJSONSync } from './read'

/**
 * 写入 JSON 文件
 * @param file 文件路径
 * @param data 数据
 */
export function writeJSONSync<T extends Record<string, unknown>>(
  file: string,
  data: T,
): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}

/**
 * 更新指定文件夹下的 packageJSON
 * @param partial pkgJSON 信息
 * @param dir 文件夹路径
 */
export function updatePkgJSON(partial: PkgJSON, dir = process.cwd()): void {
  const pkgJSONPath = path.resolve(dir, 'package.json')
  const pkgJSON = readJSONSync(pkgJSONPath)
  const pkg = deepmerge(pkgJSON, partial)

  safeWriteJSONSync(pkgJSONPath, pkg)
}

/**
 * 安全写入 JSON 文件
 * @param file 文件路径
 * @param data 数据
 */
export function safeWriteJSONSync<T extends Record<string, unknown>>(
  file: string,
  data: T,
): void {
  const tmpFile = `${file}.${v4()}-tmp`

  try {
    writeJSONSync(tmpFile, data)
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
 */
export function safeWriteFileSync(file: string, content: string): void {
  const tmpFile = `${file}.${v4()}-tmp`

  try {
    fs.writeFileSync(tmpFile, content)
    fs.renameSync(tmpFile, file)
  } catch (err) {
    // 如果发生异常, 就将 tmpFile 删除掉
    if (isPathExistsSync(tmpFile)) {
      fs.unlinkSync(tmpFile)
    }
  }
}
