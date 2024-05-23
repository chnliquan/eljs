import fs from 'fs'
import parseJSON from 'parse-json'

const fsp = fs.promises
/**
 * 读取文件内容
 * @param file 文件路径
 * @param encoding 文件编码
 */
export function readFileSync(
  file: string,
  encoding: BufferEncoding = 'utf-8',
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
  encoding: BufferEncoding = 'utf-8',
): Promise<string> {
  return fsp.readFile(file, encoding)
}

/**
 * 读取 JSON 文件
 * @param file 文件路径
 */
export function readJSONSync<T extends Record<string, unknown>>(
  file: string,
): T {
  try {
    return parseJSON(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    return Object.create(null)
  }
}

/**
 * 读取 JSON 文件
 * @param file 文件路径
 */
export async function readJSON<T extends Record<string, unknown>>(
  file: string,
): Promise<T> {
  try {
    const content = await readFile(file)
    return parseJSON(content)
  } catch (err) {
    return Object.create(null)
  }
}
