import fs from 'node:fs'
import fsp from 'node:fs/promises'
import parseJson from 'parse-json'

/**
 * 读取文件内容
 * @param file 文件路径
 * @param encoding 文件编码
 */
export function readFileSync(
  file: string,
  encoding: BufferEncoding = 'utf8',
): string {
  return fs.readFileSync(file, encoding)
}

/**
 * 读取文件内容
 * @param file 文件路径
 * @param encoding 文件编码
 */
export function readFile(
  file: string,
  encoding: BufferEncoding = 'utf8',
): Promise<string> {
  return fsp.readFile(file, encoding)
}

/**
 * 读取 Json 文件
 * @param file 文件路径
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function readJsonSync<T extends object>(file: string): T {
  try {
    return parseJson(readFileSync(file)) as T
  } catch (err) {
    return Object.create(null)
  }
}

/**
 * 读取 Json 文件
 * @param file 文件路径
 */
export async function readJson<T extends object>(file: string): Promise<T> {
  try {
    const content = await readFile(file)
    return parseJson(content) as T
  } catch (err) {
    return Object.create(null)
  }
}
