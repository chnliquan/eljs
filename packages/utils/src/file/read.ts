import fs from 'node:fs'
import fsp from 'node:fs/promises'

import { loadParseJson } from './loader-dependencies'

let parseJson: typeof import('parse-json').default

/**
 * 惰性加载并复用 JSON 解析器，避免纯文本读取提前初始化解析依赖
 * @returns JSON 解析函数
 * @internal
 */
function getParseJson(): typeof import('parse-json').default {
  parseJson ||= loadParseJson()
  return parseJson
}

/**
 * 读取文件内容
 * @param file - 文件路径
 * @param encoding - 文件编码
 */
export async function readFile(
  file: string,
  encoding: BufferEncoding = 'utf8',
): Promise<string> {
  try {
    const content = await fsp.readFile(file, encoding)
    return content
  } catch (error) {
    const err = error as Error
    err.message = `Read ${file} failed: ${err.message}`
    throw err
  }
}

/**
 * 读取文件内容
 * @param file - 文件路径
 * @param encoding - 文件编码
 */
export function readFileSync(
  file: string,
  encoding: BufferEncoding = 'utf8',
): string {
  try {
    const content = fs.readFileSync(file, encoding)
    return content
  } catch (error) {
    const err = error as Error
    err.message = `Read ${file} failed: ${err.message}`
    throw err
  }
}

/**
 * 读取 Json 文件
 * @param file - 文件路径
 */
export async function readJson<T extends object>(file: string): Promise<T> {
  const content = await readFile(file)

  try {
    const json = getParseJson()(content)
    return json as T
  } catch (error) {
    const err = error as Error
    err.message = `Parse ${file} failed: ${err.message}`
    throw err
  }
}

/**
 * 读取 Json 文件
 * @param file - 文件路径
 */

export function readJsonSync<T extends object>(file: string): T {
  const content = readFileSync(file)

  try {
    const json = getParseJson()(content)
    return json as T
  } catch (error) {
    const err = error as Error
    err.message = `Parse ${file} failed: ${err.message}`
    throw err
  }
}
